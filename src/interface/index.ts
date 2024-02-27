export interface XhrFailResponse {
  message: string;
  statusCode: number;
}

export interface S3PreUploadData {
  md5: string;
  fileName: string;
  fileType?: string;
  /**手动指定存储路径 */
  prefix?: string;
  size: number;
  uploader?: string;
  uploaderName?: string;
  meta?: Record<string, unknown>;
}

export interface S3PreUploadPart {
  PartNumber: number;
  ETag?: string;
  url?: string;
  Size: number;
  done: 0 | 1;
}

export interface S3PreUploadResponse {
  id: string;
  uploadId: string;
  bucket: string;
  key: string;
  done: boolean;
  exist: boolean;
  size?: number;
  count?: number;
  parts?: S3PreUploadPart[];
}

export interface S3CompleteUploadData {
  id: string;
  uploadId: string;
  uploader?: string;
  uploaderName?: string;
  parts: Required<Pick<S3PreUploadPart, "ETag" | "PartNumber">>[];
}

export interface S3AbortUploadData {
  id: string;
  uploadId: string;
}

export interface UploadFile {
  file: File;
  err?: string;
  done?: boolean;
  md5?: string;
  id?: string;
  uploadId?: string;
  size: number;
  count?: number;
  exist?: boolean;
  parts?: S3PreUploadPart[];
}

export type OnItemChangeFn = (index: number, task: "update" | "delete", newItem?: UploadFile) => Promise<void> | void;

export type UrlConvertFn = (url: string) => string;
