import { Node } from 'reactflow';

export interface TextNodeData {
  label: string;
  text: string;
}

export interface LlmNodeData {
  label:string;
  prompt: string;
  isLoading: boolean;
  temperature?: number;
  thinkingEnabled?: boolean;
}

export interface HttpRequestNodeData {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: string;
  body: string;
  isLoading: boolean;
}

export type CustomNodeData = TextNodeData | LlmNodeData | HttpRequestNodeData;

export type CustomNode = Node<CustomNodeData>;