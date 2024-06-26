import { BotMessageTheme, TextInputTheme, UserMessageTheme } from '@/features/bubble/types';
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
export declare const Bot: (botProps: BotProps & {
    class?: string;
}) => import("solid-js").JSX.Element;
export {};
//# sourceMappingURL=Bot.d.ts.map