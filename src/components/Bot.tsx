import { createSignal, createEffect, For, onMount, Show, mergeProps, on, createMemo } from 'solid-js';
import { v4 as uuidv4 } from 'uuid';
import { sendMessageQuery, isStreamAvailableQuery, IncomingInput, getChatbotConfig } from '@/queries/sendMessageQuery';
import { TextInput } from './inputs/textInput';
import { GuestBubble } from './bubbles/GuestBubble';
import { BotBubble } from './bubbles/BotBubble';
import { LoadingBubble } from './bubbles/LoadingBubble';
import { SourceBubble } from './bubbles/SourceBubble';
import { StarterPromptBubble } from './bubbles/StarterPromptBubble';
import { BotMessageTheme, TextInputTheme, UserMessageTheme } from '@/features/bubble/types';
import { Badge } from './Badge';
import socketIOClient from 'socket.io-client';
import axios from 'axios';
import { Popup } from '@/features/popup';
import { Avatar } from '@/components/avatars/Avatar';
import { DeleteButton, SendButton } from '@/components/buttons/SendButton';
import { CircleDotIcon, TrashIcon } from './icons';
import { CancelButton } from './buttons/CancelButton';
import { cancelAudioRecording, startAudioRecording, stopAudioRecording } from '@/utils/audioRecording';
import { useState, useEffect } from 'react';
import { create, set } from 'lodash';
import { text } from 'stream/consumers';
import { clear, count } from 'console';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage'; // Import getStorage

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyDx9f_iIwwM5wouSTT3QntFlwHcbNEqirA',
  authDomain: 'conectado-33186.firebaseapp.com',
  projectId: 'conectado-33186',
  storageBucket: 'conectado-33186.appspot.com',
  messagingSenderId: '239868035366',
  appId: '1:239868035366:web:62488feeeb1231890481e7',
  measurementId: 'G-902KJ2QKXM',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Initialize Firestore
const storage = getStorage(app); // Initialize Firebase Storage
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
export type FileEvent<T = EventTarget> = {
  target: T;
};

type ImageUploadConstraits = {
  fileTypes: string[];
  maxUploadSize: number;
};

export type UploadsConfig = {
  imgUploadSizeAndTypes: ImageUploadConstraits[];
  isImageUploadAllowed: boolean;
  isSpeechToTextEnabled: boolean;
};

type FilePreviewData = string | ArrayBuffer;

type FilePreview = {
  data: FilePreviewData;
  mime: string;
  name: string;
  preview: string;
  type: string;
};

type messageType = 'apiMessage' | 'userMessage' | 'usermessagewaiting' | 'loading';

export type FileUpload = Omit<FilePreview, 'preview'>;

export type MessageType = {
  message: string;
  type: messageType;
  sourceDocuments?: any;
  fileAnnotations?: any;
  fileUploads?: Partial<FileUpload>[];
};

export type JobMessage = {
  message: string;
  type: messageType;
  jobs: JobListing[];
};

type observerConfigType = (accessor: string | boolean | object | MessageType[]) => void;
export type observersConfigType = Record<'observeUserInput' | 'observeLoading' | 'observeMessages', observerConfigType>;

export type BotProps = {
  chatflowid: string;
  apiHost?: string;
  chatflowConfig?: Record<string, unknown>;
  welcomeMessage?: string;
  botMessage?: BotMessageTheme;
  userMessage?: UserMessageTheme;
  textInput?: TextInputTheme;
  poweredByTextColor?: string;
  badgeBackgroundColor?: string;
  bubbleBackgroundColor?: string;
  bubbleTextColor?: string;
  showTitle?: boolean;
  title?: string;
  titleAvatarSrc?: string;
  fontSize?: number;
  isFullPage?: boolean;
  observersConfig?: observersConfigType;
  userID?: string;
};

interface JobListing {
  Name: string;
  Deadline: string;
  Wage: string;
  Benefits: string;
  Job_Field: string;
  Job_Type: string;
  Schedule: string;
  Location: string;
  Details: string;
  Ed_Level: string;
  URL: string;
  Company: string;
  Opp_Type: string;
}

interface ApiResponse {
  text: string; // JSON array as a string
  chatMessageId: string;
  chatId: string;
  jobs: JobListing[] | null; // Updated property
}

const defaultWelcomeMessage = 'Need career assistance? Ask me anything!';

const defaultBackgroundColor = '#0F2D52';
const defaultTextColor = '#303235';

async function query(data: { question: string }): Promise<ApiResponse> {
  const response = await fetch('http://localhost:3000/api/v1/prediction/a32245d2-2b55-4580-bd33-b4e046a07c84', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  // const result: ApiResponse = (await response.json()) as ApiResponse; // Enforce ApiResponse type
  const result = await response.json();
  console.log('Jobs', result);
  return result;
}

export const Bot = (botProps: BotProps & { class?: string }) => {
  const [apiData, setApiData] = createSignal<ApiResponse | null>(null); //apicall hook
  const [selectedChatFlow, setSelectedChatFlow] = createSignal('9d890834-eb87-4909-930f-d420fa53a52a'); // 'regular' being the default
  const [isLoadingJobs, setIsLoadingJobs] = createSignal(false); //is loading hook
  const [userCareer, setUserCareer] = createSignal(''); //user career hook
  console.log('User ID:', botProps.userID);

  createEffect(async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      try {
        const userDocRef = doc(db, 'Users', botProps.userID ?? user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().careerField) {
          console.log('Career found:', userDoc.data().careerField);
          console.log('User:', userDoc.data());
          setUserCareer(userDoc.data().careerField);
        } else {
          console.log('No such document or career not set!');
        }
      } catch (error) {
        console.error('Error getting document:', error);
      }
    } else {
      console.log('User not logged in!');
    }
  });

  createEffect(async () => {
    if (userCareer()) {
      setIsLoadingJobs(true);
      try {
        const data = await query({ question: `Return 3 jobs in JSON related to ${userCareer()} with no white space` });
        const parsedJobs = JSON.parse(data.text.slice(7, data.text.length - 3)) as JobListing[];
        setApiData({ ...data, jobs: parsedJobs });
        console.log('Parsed jobs:', parsedJobs);
        console.log('API data:', apiData());
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingJobs(false);
      }
    }
  });

  const props = mergeProps({ showTitle: true }, botProps);
  let chatContainer: HTMLDivElement | undefined;
  let bottomSpacer: HTMLDivElement | undefined;
  let botContainer: HTMLDivElement | undefined;

  const [userInput, setUserInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [sourcePopupOpen, setSourcePopupOpen] = createSignal(false);
  const [sourcePopupSrc, setSourcePopupSrc] = createSignal({});
  const [jobMessages, setJobMessages] = createSignal<JobMessage[]>([
    {
      message: 'Input a job title to search for opportunities.',
      type: 'apiMessage',
      jobs: [],
    },
  ]);

  // Stuff for jobmessages

  const [messages, setMessages] = createSignal<MessageType[]>(
    [
      {
        message: 'Hello! I am G-AI, your personal assistant. How can I help you today?',
        // message: props.welcomeMessage ?? defaultWelcomeMessage,
        type: 'apiMessage',
      },
    ],
    { equals: false },
  );
  const [socketIOClientId, setSocketIOClientId] = createSignal('');
  const [isChatFlowAvailableToStream, setIsChatFlowAvailableToStream] = createSignal(false);
  const [chatId, setChatId] = createSignal(uuidv4());
  const [starterPrompts, setStarterPrompts] = createSignal<string[]>([], { equals: false });
  const [uploadsConfig, setUploadsConfig] = createSignal<UploadsConfig>();

  // drag & drop file input
  // TODO: fix this type
  const [previews, setPreviews] = createSignal<FilePreview[]>([]);

  // audio recording
  const [elapsedTime, setElapsedTime] = createSignal('00:00');
  const [isRecording, setIsRecording] = createSignal(false);
  const [recordingNotSupported, setRecordingNotSupported] = createSignal(false);
  const [isLoadingRecording, setIsLoadingRecording] = createSignal(false);

  // drag & drop
  const [isDragActive, setIsDragActive] = createSignal(false);

  onMount(() => {
    if (botProps?.observersConfig) {
      const { observeUserInput, observeLoading, observeMessages } = botProps.observersConfig;
      typeof observeUserInput === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeUserInput(userInput());
        });
      typeof observeLoading === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeLoading(loading());
        });
      typeof observeMessages === 'function' &&
        // eslint-disable-next-line solid/reactivity
        createMemo(() => {
          observeMessages(messages());
        });
    }

    if (!bottomSpacer) return;
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  });

  const scrollToBottom = () => {
    setTimeout(() => {
      chatContainer?.scrollTo(0, chatContainer.scrollHeight);
    }, 50);
  };

  /**
   * Add each chat message into localStorage
   */
  const addChatMessage = (allMessage: MessageType[]) => {
    localStorage.setItem(`${props.chatflowid}_EXTERNAL`, JSON.stringify({ chatId: chatId(), chatHistory: allMessage }));
  };

  const updateLastMessage = (text: string, sourceDocuments: any, fileAnnotations: any) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, message: item.message + text, sourceDocuments, fileAnnotations };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const updateLastMessageSourceDocuments = (sourceDocuments: any) => {
    setMessages((data) => {
      const updated = data.map((item, i) => {
        if (i === data.length - 1) {
          return { ...item, sourceDocuments: sourceDocuments };
        }
        return item;
      });
      addChatMessage(updated);
      return [...updated];
    });
  };

  const clearPreviews = () => {
    // Revoke the data uris to avoid memory leaks
    previews().forEach((file) => URL.revokeObjectURL(file.preview));
    setPreviews([]);
  };

  // Handle errors
  const handleError = (message = 'Oops! There seems to be an error. Please try again.') => {
    setMessages((prevMessages) => {
      const messages: MessageType[] = [...prevMessages, { message, type: 'apiMessage' }];
      addChatMessage(messages);
      return messages;
    });
    setLoading(false);
    setUserInput('');
    scrollToBottom();
  };

  const promptClick = (prompt: string) => {
    handleSubmit(prompt);
  };
  // job bubble component
  const JobBubble = (props: { jobMessage: JobMessage }) => {
    return (
      <Show when={selectedChatFlow() == 'a32245d2-2b55-4580-bd33-b4e046a07c84'}>
        <div class="job-bubble">
          <div class="job-message">
            <p>{props.jobMessage.message}</p>
          </div>
        </div>

        <Show when={props.jobMessage.jobs.length > 0}>
          <div class="job-bubble">
            <div class="job-listings">
              <For each={props.jobMessage.jobs}>
                {(job) => (
                  <a href={job.URL} target="_blank" rel="noopener noreferrer">
                    <div class="job-card-wrapper">
                      <div class="job-card">
                        <h2>{job.Job_Field}</h2>
                        <p>Company: {job.Company}</p>
                        <p>Wage: {job.Wage}</p>
                        {/* Add job_type, details, and explanation if you want to display them */}
                      </div>
                    </div>
                  </a>
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>
    );
  };

  // Handle form submission
  // handle job searches

  const handleJobSearch = async (queryText: string) => {
    setIsLoadingJobs(true); // Start loading indicator
    try {
      // Fetch job listings based on the query
      const data = await query({ question: `Return 3 jobs in JSON related to ${queryText}` });
      const parsedJobs = JSON.parse(data.text.slice(7, data.text.length - 3)) as JobListing[]; // Parse the JSON response
      console.log('parsedjobs before', parsedJobs);
      const message = parsedJobs.length > 0 ? `Here are the job listings related to: ${queryText}` : 'No job listings found.';
      // Create a JobMessage
      const jobMessage: JobMessage = {
        message,
        type: 'apiMessage',
        jobs: parsedJobs,
      };
      // Update the job messages state with the new job listings or a message indicating no jobs were found
      if (parsedJobs && parsedJobs.length > 0) {
        setJobMessages((prevMessages) => [...prevMessages, jobMessage]);

        console.log('parsedjobs after', parsedJobs);
      } else {
        setJobMessages((prevMessages) => [...prevMessages, { message: 'No job listings found for your query.', type: 'apiMessage', jobs: [] }]);
      }
    } catch (error) {
      console.error('Error fetching job listings:', error);
      handleError('Failed to fetch job listings. Please try again.');
    } finally {
      setLoading(false);
      setIsLoadingJobs(false); // Stop loading indicator
      setUserInput(''); // Clear user input
      scrollToBottom(); // Scroll to show the latest message or job listings
    }
  };

  // update message
  const updateChatWithApiResponse = (apiResponse: any) => {
    // Example response processing
    // Adapt this part according to your API's response structure

    // Check if the API response includes text to display
    if (apiResponse.text) {
      // setMessages((prevMessages) => [
      //   ...prevMessages,
      //   {
      //     message: apiResponse.text, // Display the message text from the response
      //     type: 'apiMessage', // Assuming you have a specific type for messages from the bot/API
      //     // Include any other relevant fields from the API response
      //     sourceDocuments: apiResponse.sourceDocuments,
      //     fileAnnotations: apiResponse.fileAnnotations,
      //   },
      // ]);
    } else {
      // Handle cases where the expected fields are missing or the response is not as expected
      console.error("API response didn't include expected 'text' field:", apiResponse);
      // Optionally display a fallback or error message in the chat
      setMessages((prevMessages) => [...prevMessages, { message: "Sorry, I didn't understand that. Can you try rephrasing?", type: 'apiMessage' }]);
    }

    // Ensure the chat scrolls to show the latest message
    scrollToBottom();
  };

  // Handle form submission
  const handleSubmit = async (value: string) => {
    setUserInput(value);

    if (value.trim() === '') {
      const containsAudio = previews().filter((item) => item.type === 'audio').length > 0;
      if (!(previews().length >= 1 && containsAudio)) {
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    scrollToBottom();

    // Check if the chat flow is set to job search
    if (selectedChatFlow() === 'a32245d2-2b55-4580-bd33-b4e046a07c84') {
      // Job search functionality
      handleJobSearch(value);
    } else {
      // Regular chat functionality
      const welcomeMessage = props.welcomeMessage ?? defaultWelcomeMessage;
      const messageList = messages().filter((msg) => msg.message !== welcomeMessage);
      const urls = previews().map((item) => ({
        data: item.data,
        type: item.type,
        name: item.name,
        mime: item.mime,
      }));

      clearPreviews();
      setMessages((prevMessages) => [...prevMessages, { message: value, type: 'userMessage', fileUploads: urls }]);

      const body: IncomingInput = {
        question: value,
        history: messageList,
        chatId: chatId(),
        uploads: urls,
        overrideConfig: props.chatflowConfig,
        socketIOClientId: isChatFlowAvailableToStream() ? socketIOClientId() : undefined,
      };

      try {
        const result = await sendMessageQuery({
          chatflowid: selectedChatFlow(),
          apiHost: props.apiHost,
          body,
        });

        // Process the response from the API
        if (result.data) {
          updateChatWithApiResponse(result.data);
        }
      } catch (error) {
        console.error('An unexpected error occurred:', error);
        handleError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
        setUserInput('');
      }
    }
  };

  const clearChat = () => {
    try {
      localStorage.removeItem(`${props.chatflowid}_EXTERNAL`);
      setChatId(uuidv4());
      setMessages([
        {
          message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: 'apiMessage',
        },
      ]);
    } catch (error: any) {
      const errorData = error.response.data || `${error.response.status}: ${error.response.statusText}`;
      console.error(`error: ${errorData}`);
    }
  };
  // Auto scroll chat to bottom
  createEffect(() => {
    if (messages()) scrollToBottom();
  });

  createEffect(() => {
    if (props.fontSize && botContainer) botContainer.style.fontSize = `${props.fontSize}px`;
  });

  // eslint-disable-next-line solid/reactivity
  createEffect(async () => {
    const chatMessage = localStorage.getItem(`${props.chatflowid}_EXTERNAL`);
    if (chatMessage) {
      const objChatMessage = JSON.parse(chatMessage);
      setChatId(objChatMessage.chatId);
      const loadedMessages = objChatMessage.chatHistory.map((message: MessageType) => {
        const chatHistory: MessageType = {
          message: message.message,
          type: message.type,
        };
        if (message.sourceDocuments) chatHistory.sourceDocuments = message.sourceDocuments;
        if (message.fileAnnotations) chatHistory.fileAnnotations = message.fileAnnotations;
        if (message.fileUploads) chatHistory.fileUploads = message.fileUploads;
        return chatHistory;
      });
      setMessages([...loadedMessages]);
    }

    // Determine if particular chatflow is available for streaming
    const { data } = await isStreamAvailableQuery({
      chatflowid: props.chatflowid,
      apiHost: props.apiHost,
    });

    if (data) {
      setIsChatFlowAvailableToStream(data?.isStreaming ?? false);
    }

    // Get the chatbotConfig
    const result = await getChatbotConfig({
      chatflowid: props.chatflowid,
      apiHost: props.apiHost,
    });

    if (result.data) {
      const chatbotConfig = result.data;
      if (chatbotConfig.starterPrompts) {
        const prompts: string[] = [];
        Object.getOwnPropertyNames(chatbotConfig.starterPrompts).forEach((key) => {
          prompts.push(chatbotConfig.starterPrompts[key].prompt);
        });
        setStarterPrompts(prompts);
      }
      if (chatbotConfig.uploads) {
        setUploadsConfig(chatbotConfig.uploads);
      }
    }

    const socket = socketIOClient(props.apiHost as string);

    socket.on('connect', () => {
      setSocketIOClientId(socket.id);
    });

    socket.on('start', () => {
      setMessages((prevMessages) => [...prevMessages, { message: '', type: 'apiMessage' }]);
    });

    socket.on('sourceDocuments', updateLastMessageSourceDocuments);

    socket.on('token', updateLastMessage);

    // eslint-disable-next-line solid/reactivity
    return () => {
      setUserInput('');
      setLoading(false);
      setMessages([
        {
          message: "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
          // message: props.welcomeMessage ?? defaultWelcomeMessage,
          type: 'apiMessage',
        },
      ]);
      if (socket) {
        socket.disconnect();
        setSocketIOClientId('');
      }
    };
  });

  const isValidURL = (url: string): URL | undefined => {
    try {
      return new URL(url);
    } catch (err) {
      return undefined;
    }
  };

  const removeDuplicateURL = (message: MessageType) => {
    const visitedURLs: string[] = [];
    const newSourceDocuments: any = [];

    message.sourceDocuments.forEach((source: any) => {
      if (isValidURL(source.metadata.source) && !visitedURLs.includes(source.metadata.source)) {
        visitedURLs.push(source.metadata.source);
        newSourceDocuments.push(source);
      } else if (!isValidURL(source.metadata.source)) {
        newSourceDocuments.push(source);
      }
    });
    return newSourceDocuments;
  };

  const addRecordingToPreviews = (blob: Blob) => {
    const mimeType = blob.type.substring(0, blob.type.indexOf(';'));
    // read blob and add to previews
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as FilePreviewData;
      const upload: FilePreview = {
        data: base64data,
        preview: '../assets/wave-sound.jpg',
        type: 'audio',
        name: 'audio.wav',
        mime: mimeType,
      };
      setPreviews((prevPreviews) => [...prevPreviews, upload]);
    };
  };

  const isFileAllowedForUpload = (file: File) => {
    let acceptFile = false;
    if (uploadsConfig() && uploadsConfig()?.isImageUploadAllowed && uploadsConfig()?.imgUploadSizeAndTypes) {
      const fileType = file.type;
      const sizeInMB = file.size / 1024 / 1024;
      uploadsConfig()?.imgUploadSizeAndTypes.map((allowed) => {
        if (allowed.fileTypes.includes(fileType) && sizeInMB <= allowed.maxUploadSize) {
          acceptFile = true;
        }
      });
    }
    if (!acceptFile) {
      alert(`Cannot upload file. Kindly check the allowed file types and maximum allowed size.`);
    }
    return acceptFile;
  };

  const handleFileChange = async (event: FileEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }
    const filesList = [];
    for (const file of files) {
      if (isFileAllowedForUpload(file) === false) {
        return;
      }
      const reader = new FileReader();
      const { name } = file;
      filesList.push(
        new Promise((resolve) => {
          reader.onload = (evt) => {
            if (!evt?.target?.result) {
              return;
            }
            const { result } = evt.target;
            resolve({
              data: result,
              preview: URL.createObjectURL(file),
              type: 'file',
              name: name,
              mime: file.type,
            });
          };
          reader.readAsDataURL(file);
        }),
      );
    }

    const newFiles = await Promise.all(filesList);
    setPreviews((prevPreviews) => [...prevPreviews, ...(newFiles as FilePreview[])]);
  };

  const handleDrag = (e: DragEvent) => {
    if (uploadsConfig()?.isImageUploadAllowed) {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') {
        setIsDragActive(true);
      } else if (e.type === 'dragleave') {
        setIsDragActive(false);
      }
    }
  };

  const handleDrop = async (e: InputEvent | DragEvent) => {
    if (!uploadsConfig()?.isImageUploadAllowed) {
      return;
    }
    e.preventDefault();
    setIsDragActive(false);
    const files = [];
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        if (isFileAllowedForUpload(file) === false) {
          return;
        }
        const reader = new FileReader();
        const { name } = file;
        files.push(
          new Promise((resolve) => {
            reader.onload = (evt) => {
              if (!evt?.target?.result) {
                return;
              }
              const { result } = evt.target;
              let previewUrl;
              if (file.type.startsWith('audio/')) {
                previewUrl = '../assets/wave-sound.jpg';
              } else if (file.type.startsWith('image/')) {
                previewUrl = URL.createObjectURL(file);
              }
              resolve({
                data: result,
                preview: previewUrl,
                type: 'file',
                name: name,
                mime: file.type,
              });
            };
            reader.readAsDataURL(file);
          }),
        );
      }

      const newFiles = await Promise.all(files);
      setPreviews((prevPreviews) => [...prevPreviews, ...(newFiles as FilePreview[])]);
    }

    if (e.dataTransfer && e.dataTransfer.items) {
      for (const item of e.dataTransfer.items) {
        if (item.kind === 'string' && item.type.match('^text/uri-list')) {
          item.getAsString((s: string) => {
            const upload: FilePreview = {
              data: s,
              preview: s,
              type: 'url',
              name: s.substring(s.lastIndexOf('/') + 1),
              mime: '',
            };
            setPreviews((prevPreviews) => [...prevPreviews, upload]);
          });
        } else if (item.kind === 'string' && item.type.match('^text/html')) {
          item.getAsString((s: string) => {
            if (s.indexOf('href') === -1) return;
            //extract href
            const start = s.substring(s.indexOf('href') + 6);
            const hrefStr = start.substring(0, start.indexOf('"'));

            const upload: FilePreview = {
              data: hrefStr,
              preview: hrefStr,
              type: 'url',
              name: hrefStr.substring(hrefStr.lastIndexOf('/') + 1),
              mime: '',
            };
            setPreviews((prevPreviews) => [...prevPreviews, upload]);
          });
        }
      }
    }
  };

  const handleDeletePreview = (itemToDelete: FilePreview) => {
    if (itemToDelete.type === 'file') {
      URL.revokeObjectURL(itemToDelete.preview); // Clean up for file
    }
    setPreviews(previews().filter((item) => item !== itemToDelete));
  };

  const onMicrophoneClicked = () => {
    setIsRecording(true);
    startAudioRecording(setIsRecording, setRecordingNotSupported, setElapsedTime);
  };

  const onRecordingCancelled = () => {
    if (!recordingNotSupported) cancelAudioRecording();
    setIsRecording(false);
    setRecordingNotSupported(false);
  };

  const onRecordingStopped = async () => {
    setIsLoadingRecording(true);
    stopAudioRecording(addRecordingToPreviews);
  };

  createEffect(
    // listen for changes in previews
    on(previews, (uploads) => {
      // wait for audio recording to load and then send
      const containsAudio = uploads.filter((item) => item.type === 'audio').length > 0;
      if (uploads.length >= 1 && containsAudio) {
        setIsRecording(false);
        setRecordingNotSupported(false);
        promptClick('');
      }

      return () => {
        setPreviews([]);
      };
    }),
  );

  return (
    <>
      <div
        ref={botContainer}
        class={'relative flex w-full h-full text-base overflow-hidden bg-cover bg-center flex-col items-center chatbot-container ' + props.class}
        onDragEnter={handleDrag}
      >
        {isDragActive() && (
          <div
            class="absolute top-0 left-0 bottom-0 right-0 w-full h-full z-50"
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragEnd={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          />
        )}
        {isDragActive() && uploadsConfig()?.isImageUploadAllowed && (
          <div
            class="absolute top-0 left-0 bottom-0 right-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white z-40 gap-2 border-2 border-dashed"
            style={{ 'border-color': props.bubbleBackgroundColor }}
          >
            <h2 class="text-xl font-semibold">Drop here to upload</h2>
            <For each={uploadsConfig()?.imgUploadSizeAndTypes}>
              {(allowed) => {
                return (
                  <>
                    <span>{allowed.fileTypes?.join(', ')}</span>
                    <span>Max Allowed Size: {allowed.maxUploadSize} MB</span>
                  </>
                );
              }}
            </For>
          </div>
        )}

        {props.showTitle ? (
          <div
            class="flex flex-row items-center w-full h-[50px] absolute top-0 left-0 z-10"
            style={{
              background: props.bubbleBackgroundColor,
              color: props.bubbleTextColor,
              'border-top-left-radius': props.isFullPage ? '0px' : '6px',
              'border-top-right-radius': props.isFullPage ? '0px' : '6px',
            }}
          >
            <Show when={props.titleAvatarSrc}>
              <>
                <div style={{ width: '15px' }} />
                <Avatar initialAvatarSrc={props.titleAvatarSrc} />
              </>
            </Show>
            <Show when={props.title}>
              <span class="px-3 whitespace-pre-wrap font-semibold max-w-full">{props.title}</span>
            </Show>
            <div style={{ flex: 1 }} />
            <DeleteButton
              sendButtonColor={props.bubbleTextColor}
              type="button"
              isDisabled={messages().length === 1}
              class="my-2 ml-2"
              on:click={clearChat}
            >
              <span style={{ 'font-family': 'Poppins, sans-serif' }}>Clear</span>
            </DeleteButton>
          </div>
        ) : null}
        <div class="flex flex-col w-full h-full justify-start z-0">
          <div
            ref={chatContainer}
            class="overflow-y-scroll flex flex-col flex-grow min-w-full w-full px-3 pt-[70px] relative scrollable-container chatbot-chat-view scroll-smooth"
          >
            <Show when={messages.length >= 0}>
              <div class="choice-buttons-row">
                <button onClick={() => setSelectedChatFlow('9d890834-eb87-4909-930f-d420fa53a52a')} class="ai-setting">
                  Regular Chat
                </button>
                <button onClick={() => setSelectedChatFlow('a32245d2-2b55-4580-bd33-b4e046a07c84')} class="ai-setting">
                  Job Search
                </button>
              </div>
            </Show>

            {/* ApiData Contaner  */}
            <Show when={selectedChatFlow() == 'a32245d2-2b55-4580-bd33-b4e046a07c84'}>
              <div class="api-data-container">
                <div class="card-container">
                  <For each={apiData()?.jobs}>
                    {(job) => {
                      // Type enforcement and index access
                      return (
                        <a href={job.URL} target="_blank" rel="noopener noreferrer">
                          <div class="job-card-wrapper">
                            {' '}
                            {/* Using 'name' as a placeholder key */}
                            <div class="job-card">
                              <h2>{job.Job_Field}</h2>
                              <p>Company: {job.Company}</p>
                              <p>Wage: {job.Wage}</p>
                              {/* Add job_type, details, and explanation if you want to display them */}
                            </div>
                          </div>
                        </a>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>
            {/* Render job messages */}

            <For each={jobMessages()}>{(jobMessage) => <JobBubble jobMessage={jobMessage} />}</For>

            {/* REgular messages */}
            <Show when={selectedChatFlow() == '9d890834-eb87-4909-930f-d420fa53a52a'}>
              <For each={[...messages()]}>
                {(message, index) => {
                  return (
                    <>
                      {message.type === 'userMessage' && (
                        <GuestBubble
                          message={message}
                          apiHost={props.apiHost}
                          chatflowid={props.chatflowid}
                          chatId={chatId()}
                          backgroundColor={props.userMessage?.backgroundColor}
                          textColor={props.userMessage?.textColor}
                          showAvatar={props.userMessage?.showAvatar}
                          avatarSrc={props.userMessage?.avatarSrc}
                        />
                      )}
                      {message.type === 'apiMessage' && (
                        <BotBubble
                          message={message.message}
                          fileAnnotations={message.fileAnnotations}
                          apiHost={props.apiHost}
                          backgroundColor={props.botMessage?.backgroundColor}
                          textColor={props.botMessage?.textColor}
                          showAvatar={props.botMessage?.showAvatar}
                          avatarSrc={props.botMessage?.avatarSrc}
                        />
                      )}
                      {message.type === 'userMessage' && loading() && index() === messages().length - 1 && <LoadingBubble />}
                      {message.type === 'apiMessage' && message.message === '' && loading() && index() === messages().length - 1 && <LoadingBubble />}
                      {message.sourceDocuments && message.sourceDocuments.length && (
                        <div style={{ display: 'flex', 'flex-direction': 'row', width: '100%' }}>
                          <For each={[...removeDuplicateURL(message)]}>
                            {(src) => {
                              const URL = isValidURL(src.metadata.source);
                              return (
                                <SourceBubble
                                  pageContent={URL ? URL.pathname : src.pageContent}
                                  metadata={src.metadata}
                                  onSourceClick={() => {
                                    if (URL) {
                                      window.open(src.metadata.source, '_blank');
                                    } else {
                                      setSourcePopupSrc(src);
                                      setSourcePopupOpen(true);
                                    }
                                  }}
                                />
                              );
                            }}
                          </For>
                        </div>
                      )}
                    </>
                  );
                }}
              </For>
            </Show>

            <Show when={messages().length === 1 && selectedChatFlow() == '9d890834-eb87-4909-930f-d420fa53a52a'}>
              <Show when={starterPrompts().length > 0}>
                <div class="w-full flex flex-row flex-wrap px-5 py-[10px] gap-2">
                  <For each={[...starterPrompts()]}>{(key) => <StarterPromptBubble prompt={key} onPromptClick={() => promptClick(key)} />}</For>
                </div>
              </Show>
            </Show>

            {/* Loading sign */}
            <Show when={isLoadingJobs() && selectedChatFlow() == 'a32245d2-2b55-4580-bd33-b4e046a07c84'}>
              <div class="loading-jobs-message-container">Loading Opportunities...</div>
            </Show>
          </div>

          <Show when={previews().length > 0}>
            <div class="w-full flex items-center justify-start gap-2 px-5 pt-2 border-t border-[#eeeeee]">
              <For each={[...previews()]}>
                {(item) => (
                  <>
                    {item.mime.startsWith('image/') ? (
                      <button
                        class="group w-12 h-12 flex items-center justify-center relative rounded-[10px] overflow-hidden transition-colors duration-200"
                        onClick={() => handleDeletePreview(item)}
                      >
                        <img class="w-full h-full bg-cover" src={item.data as string} />
                        <span class="absolute hidden group-hover:flex items-center justify-center z-10 w-full h-full top-0 left-0 bg-black/10 rounded-[10px] transition-colors duration-200">
                          <TrashIcon />
                        </span>
                      </button>
                    ) : (
                      <div
                        class={`inline-flex basis-auto flex-grow-0 flex-shrink-0 justify-between items-center rounded-xl h-12 p-1 mr-1 bg-gray-500`}
                        style={{
                          width: `${
                            chatContainer ? (botProps.isFullPage ? chatContainer?.offsetWidth / 4 : chatContainer?.offsetWidth / 2) : '200'
                          }px`,
                        }}
                      >
                        <audio class="block bg-cover bg-center w-full h-full rounded-none text-transparent" controls src={item.data as string} />
                        <button class="w-7 h-7 flex items-center justify-center bg-transparent p-1" onClick={() => handleDeletePreview(item)}>
                          <TrashIcon color="white" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </For>
            </div>
          </Show>
          <div class="w-full px-5 pt-2 pb-1">
            {isRecording() ? (
              <>
                {recordingNotSupported() ? (
                  <div class="w-full flex items-center justify-between p-4 border border-[#eeeeee]">
                    <div class="w-full flex items-center justify-between gap-3">
                      <span class="text-base">To record audio, use modern browsers like Chrome or Firefox that support audio recording.</span>
                      <button
                        class="py-2 px-4 justify-center flex items-center bg-red-500 text-white rounded-md"
                        type="button"
                        onClick={() => onRecordingCancelled()}
                      >
                        Okay
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    class="h-[58px] flex items-center justify-between chatbot-input border border-[#eeeeee]"
                    data-testid="input"
                    style={{
                      margin: 'auto',
                      'background-color': props.textInput?.backgroundColor ?? defaultBackgroundColor,
                      color: props.textInput?.textColor ?? defaultTextColor,
                    }}
                  >
                    <div class="flex items-center gap-3 px-4 py-2">
                      <span>
                        <CircleDotIcon color="red" />
                      </span>
                      <span>{elapsedTime() || '00:00'}</span>
                      {isLoadingRecording() && <span class="ml-1.5">Sending...</span>}
                    </div>
                    <div class="flex items-center">
                      <CancelButton buttonColor={props.textInput?.sendButtonColor} type="button" class="m-0" on:click={onRecordingCancelled}>
                        <span style={{ 'font-family': 'Poppins, sans-serif' }}>Send</span>
                      </CancelButton>
                      <SendButton
                        sendButtonColor={props.textInput?.sendButtonColor}
                        type="button"
                        isDisabled={loading()}
                        class="m-0"
                        on:click={onRecordingStopped}
                      >
                        <span style={{ 'font-family': 'Poppins, sans-serif' }}>Send</span>
                      </SendButton>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <TextInput
                backgroundColor={props.textInput?.backgroundColor}
                textColor={props.textInput?.textColor}
                placeholder={props.textInput?.placeholder}
                sendButtonColor={props.textInput?.sendButtonColor}
                fontSize={props.fontSize}
                disabled={loading()}
                defaultValue={userInput()}
                onSubmit={handleSubmit}
                uploadsConfig={uploadsConfig()}
                setPreviews={setPreviews}
                onMicrophoneClicked={onMicrophoneClicked}
                handleFileChange={handleFileChange}
              />
            )}
          </div>
          {/* <Badge badgeBackgroundColor={props.badgeBackgroundColor} poweredByTextColor={props.poweredByTextColor} botContainer={botContainer} /> */}
        </div>
      </div>
      {sourcePopupOpen() && <Popup isOpen={sourcePopupOpen()} value={sourcePopupSrc()} onClose={() => setSourcePopupOpen(false)} />}
    </>
  );
};

// type BottomSpacerProps = {
//   ref: HTMLDivElement | undefined;
// };
// const BottomSpacer = (props: BottomSpacerProps) => {
//   return <div ref={props.ref} class="w-full h-32" />;
// };
