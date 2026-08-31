export type Role = "user" | "assistant" | "system";

export interface Attachment {
  name: string;
  size: number;
  kind: "text" | "image";
  content?: string; // text files
  dataUrl?: string; // images (resized base64 JPEG)
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt?: number;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}