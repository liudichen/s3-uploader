import type { ComponentType, ReactNode, RefObject } from "react";
import type { SxProps } from "@mui/material";
import type { AxiosDefaults, AxiosRequestConfig } from "axios";
import type { DropEvent, DropzoneOptions } from "react-dropzone";

export interface S3PreUploadData {
  /** 上传文件来源平台*/
  platform: string;
  /** 平台上的某一应用 */
  app?: string;
  /**手动指定桶名,实际并不一定会使用（如果其它桶中已上传的情况下） */
  bucket?: string;
  md5: string;
  fileName: string;
  fileType?: string;
  /**手动指定在桶中的存储路径 */
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
  /**已存在已完成的上传任务 */
  exist: boolean;
  size?: number;
  count?: number;
  url?: string;
  parts?: S3PreUploadPart[];
}

export interface S3CompleteUploadData {
  id: string;
  uploadId: string;
  uploader?: string;
  uploaderName?: string;
  parts: Required<Pick<S3PreUploadPart, "ETag" | "PartNumber">>[];
}

export interface S3CompleteUploadResponse {
  id: string;
  url: string;
}

export interface S3AbortUploadData {
  id: string;
  uploadId: string;
}

export interface UploadFile {
  file?: File;
  name: string;
  type?: string;
  err?: string;
  errType?: "validate" | "md5" | "preUpload" | "completeUpload" | "partUpload";
  url?: string;
  done?: boolean;
  md5?: string;
  id?: string;
  uploadId?: string;
  size: number;
  /**分片数量,仅文件之前未完整上传时有 */
  count?: number;
  exist?: boolean;
  parts?: S3PreUploadPart[];
}

export type OnItemChangeFn = (index: number, task: "update" | "delete", newItem?: UploadFile) => Promise<void> | void;

export type UrlConvertFn = (
  url: string,
  type: "request" | "response",
  task: "preUpload" | "partUpload" | "completeUpload" | "abortUpload"
) => string;

interface RequestionOptions extends Omit<AxiosRequestConfig, "data" | "url"> {
  onError?: (error?: any) => void;
  urlConvert?: UrlConvertFn;
}

export type S3PreUploadRequestFn = (
  url: string,
  data: S3PreUploadData,
  options?: RequestionOptions
) => Promise<S3PreUploadResponse>;

export type S3PartUploadRequestFn = (url: string, data: Blob, options?: RequestionOptions) => Promise<true>;

export type S3CompleteUploadRequestFn = (
  url: string,
  data: S3CompleteUploadData,
  options?: RequestionOptions
) => Promise<S3CompleteUploadResponse>;

export type S3AbortUploadRequestFn = (
  url: string,
  data: S3AbortUploadData,
  options?: RequestionOptions
) => Promise<true>;

export interface S3UploaderIProps
  extends Partial<Omit<DropzoneOptions, "onDropAccepted" | "multiple">>,
    S3RelateItemProps {
  value?: UploadFile[];
  onChange?: (v: UploadFile[]) => void;
  defaultValue?: UploadFile[];
  error?: boolean;
  readOnly?: boolean;

  /**返回候选可以上传的文件数组 */
  onDropAccepted?:
    | (<T extends File>(files: T[], event: DropEvent) => Promise<File[]>)
    | (<T extends File>(files: T[], event: DropEvent) => File[]);

  className?: string;
  uploadZoneClassName?: string;
  uploadItemClassName?: string;

  isSameFile?: IsSameFileFn;

  /**触发DropZone的元素节点 */
  dropZoneTrigger?: ReactNode;
  dropZoneSx?: SxProps;
  /**校验文件本身是否满足要求，如果不满足返回不满足的字符串否则返回空字符串或无返回值,不满足要求的 */
  fileChecker?: ((file: File) => string | undefined) | ((file: File) => Promise<string | undefined>);
}

export interface Md5GetterOptions {
  /**每次读取的文件切片大小
   * @default 4194304='4M'
   */
  chunkSize?: number;
  abortRef?: RefObject<boolean>;
  onprogress?: (p: number) => void;
  onerror?: (event?: any) => void;
}

export type Md5GetterFn =
  | ((file: File, options?: Md5GetterOptions) => string | 0 | false)
  | ((file: File) => Promise<string | 0 | false>);

export type FileIconRender = (file: UploadFile) => ReactNode;

export type IsSameFileFn = (a: File, b?: File) => boolean;

interface S3RelateItemProps {
  /** 上传文件来源平台*/
  platform: string;
  /** 平台上的某一应用 */
  app?: string;
  /**手动指定桶名,实际并不一定会使用（如果其它桶中已上传的情况下） */
  bucket?: string;
  /**文件在桶中的存储路径 */
  filePrefix?: string;
  s3PreUploadUrl: string;
  s3CompleteUploadUrl: string;
  s3AbortUploadUrl?: string;
  s3PreUploadRequest?: S3PreUploadRequestFn;
  s3PartUploadRequest?: S3PartUploadRequestFn;
  s3CompleteUploadRequest?: S3CompleteUploadRequestFn;
  s3AbortUploadRequest?: S3AbortUploadRequestFn;

  /**当返回0时表示md5在计算过程中手动终止,false表示出错了 */
  md5Getter?: Md5GetterFn;

  baseURL?: string;
  timeout?: number;

  fileIconRender?: FileIconRender;

  /**分片上传并发数量限制 */
  limit?: number;
  /**分片上传后端返回的url的转换函数 */
  urlConvert?: UrlConvertFn;
  /**达到并发限制时,等待多少ms再次进行检查是否达到并发数量限制
   * @default 1000
   */
  chunkWaitTime?: number;
  meta?: Record<string, number | string>;
  uploader?: string;
  uploaderName?: string;
}

export interface UploadFileItemProps extends S3RelateItemProps {
  i: number;
  item: UploadFile;
  onItemChange: OnItemChangeFn;
  readOnly?: boolean;

  className?: string;
}

export type FileUploadStep = "md5计算" | "初始化" | "上传中" | "完成";
