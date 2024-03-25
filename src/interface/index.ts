import type { ComponentType, Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { AxiosRequestConfig } from "axios";
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
  /**分片上传任务的临时url，未上传的分片才有 */
  url?: string;
  Size: number;
  done: 0 | 1;
}

export interface S3PreUploadResponse {
  /** 任务数据库Id */
  id: string;

  /** s3 UploadId */
  uploadId: string;

  done: boolean;

  /**已存在已完成的上传任务 */
  exist: boolean;

  size?: number;

  /**分片总数量 */
  count?: number;

  url?: string;

  /** 分片任务，未存在上传完成的任务时需要返回以用于后续分片上传 */
  parts?: S3PreUploadPart[];

  /**存储桶名 */
  Bucket?: string;
  /**文件在桶内路径,注意文件名可能与当前文件名不一致 */
  Key?: string;
  /**当已存在文件时,版本id */
  VersionId?: string;
}

export interface S3CompleteUploadData {
  id: string;
  uploadId: string;
  uploader?: string;
  uploaderName?: string;
  parts: Required<Pick<S3PreUploadPart, "ETag" | "PartNumber">>[];
}

export interface S3CompleteUploadResponse {
  id?: string;
  url?: string;
  Bucket?: string;
  Key?: string;
  VersionId?: string;
}

export interface S3AbortUploadData {
  id: string;
  uploadId: string;
}

export interface UploadFile {
  file?: File;
  /**文件名, File.name*/
  name: string;
  /**文件类型,即 File.type */
  type?: string;
  /** 文件上传或校验过程的错误文本 */
  err?: string;
  /** 错误类型,揭示哪个阶段发生了错误 */
  errType?: "validate" | "md5" | "preUpload" | "completeUpload" | "partUpload";
  /** 已上传完毕? */
  done?: boolean;
  md5?: string;
  /** 文件上传任务的数据库表id */
  id?: string;
  /**分片上传任务的s3 UploadId */
  uploadId?: string;
  /**文件大小,即 File.size */
  size: number;
  /**分片总数量,仅文件之前未完整上传时有(可选) */
  count?: number;
  /** 服务器中在本次上传前已存在上传完成的文件?*/
  exist?: boolean;
  /** 后端返回分片上传任务(如果有任务则会完整返回PartNumber从1到Math.ceil(size/chunkSize)所有分片的任务信息,未完成的会有直接上传的url),done=true时会被清空 */
  parts?: S3PreUploadPart[];
  /**文件是否被选择,当开启了文件选择时有意义
   * @default false
   */
  checked?: boolean;
  /**当成功时返回的存储桶名 */
  Bucket?: string;
  /**当成功时返回的实际文件路径,注意文件名可能与当前文件名不一致 */
  Key?: string;
  /**当成功时返回的版本id */
  VersionId?: string;
  /** 当成功时返回的在s3中的临时访问url */
  url?: string;
  step?: FileUploadStep;
}

export type OnItemChangeFn = (
  index: number,
  task: "update" | "delete" | "select",
  newItem?: UploadFile
) => Promise<void> | void;

export type UrlConvertFn = (
  url: string,
  type?: "request" | "response",
  task?: "preUpload" | "partUpload" | "completeUpload" | "abortUpload"
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

export interface S3UploaderProps
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

  /**应用于根组件 Stack */
  className?: string;

  /**应用于上传或拖拽区根div组件 */
  uploadZoneClassName?: string;

  /** 应用于每个子文件组件的根Box组件 */
  uploadItemClassName?: string;

  /** 判断是否是同一文件的方法,如果返回true则该文件与已有文件相同,不能添加 */
  isSameFile?: IsSameFileFn;

  /**触发DropZone的元素节点 */
  dropZoneTrigger?: ReactNode;

  /**校验文件本身是否满足要求，如果不满足返回不满足的字符串否则返回空字符串或无返回值,不满足要求的 */
  fileChecker?: ((file: File) => string | undefined) | ((file: File) => Promise<string | undefined>);
}

export interface Md5GetterOptions {
  /**计算md5时每次读取的文件切片大小
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

type FilePreviewComponent = ComponentType<{
  open?: boolean;
  onChange: Dispatch<SetStateAction<boolean>>;
  item: UploadFile;
}>;

export interface FileIconRenderProps {
  item: UploadFile;
  preview?: boolean;
  PreviewRender?: FilePreviewComponent;
}

export type IsSameFileFn = (a: File, b?: File) => boolean;

interface S3RelateItemProps {
  /**分片上传的分片大小,minio默认为5M
   * @default 5242880='5M'
   */
  chunkSize?: number;
  /** 文件可预览? */
  preview?: boolean;
  /**预览文件的组件(推荐是弹窗之类不占用文档流) */
  PreviewRender?: FilePreviewComponent;

  /**显示文件可选择项 */
  selectable?: boolean;
  /**文件多选还是单选
   * @default 'multiple'
   */
  selectType?: "single" | "multiple";
  /** 上传文件来源平台*/
  platform: string;
  /** 平台上的某一应用 */
  app?: string;
  /**手动指定桶名,实际并不一定会使用（如果其它桶中已上传的情况下） */
  bucket?: string;
  /**文件在桶中的存储路径 */
  filePrefix?: string;
  /**文件上传前检查文件在服务器中状态或任务的url */
  s3PreUploadUrl: string;
  /**文件分片全部上传后通知合并的url */
  s3CompleteUploadUrl: string;
  /**取消分片任务的url */
  s3AbortUploadUrl?: string;
  /**文件上传前的请求，检查服务器是否已存在文件，如果存在直接返回结果，不存在则返回创建的分片上传任务,有内置的，需要自定替换 */
  s3PreUploadRequest?: S3PreUploadRequestFn;
  /**向s3生成的单个分片上传任务上传文件的请求,按api这应该是个PUT请求，url是s3PreUploadRequest返回的parts中携带的 */
  s3PartUploadRequest?: S3PartUploadRequestFn;
  /** 当所有分片上传后通知服务进行分片合并的请求 */
  s3CompleteUploadRequest?: S3CompleteUploadRequestFn;
  /** 取消分片上传任务的请求，当前并没有去实现,采用的是任务设置失效时间的方式 */
  s3AbortUploadRequest?: S3AbortUploadRequestFn;

  /**当返回0时表示md5在计算过程中手动终止,false表示出错了 */
  md5Getter?: Md5GetterFn;

  /**axios baseURL */
  baseURL?: string;
  /**axios请求的超时时间(ms)
   * @default 15000 = 15s
   */
  timeout?: number;

  /** 渲染文档图标的组件,可选,有内置的默认组件*/
  FileIconRender?: ComponentType<FileIconRenderProps>;

  /**分片上传并发数量限制
   * @default 3
   */
  limit?: number;
  /** 请求及请求返回的url地址在请求前或存进value前的转换函数,如果不传或没有返回值，则使用原始值 */
  urlConvert?: UrlConvertFn;
  /**达到并发限制时,等待多少ms再次进行检查是否达到并发数量限制
   * @default 1000
   */
  chunkWaitTime?: number;
  /**文件上传的额外的s3 MetaData */
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

export type FileUploadStep = "文件校验" | "md5计算" | "初始化" | "上传中" | "完成" | "文件合并";
