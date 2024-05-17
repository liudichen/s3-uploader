# @iimm/s3-uploader

[![NPM version](https://img.shields.io/npm/v/@iimm/s3-uploader.svg?style=flat)](https://npmjs.org/package/@iimm/s3-uploader)
[![NPM downloads](http://img.shields.io/npm/dm/@iimm/s3-uploader.svg?style=flat)](https://npmjs.org/package/@iimm/s3-uploader)

学习阶段自定义的尝试用来进行本地minio s3 分片（分片默认大小是为`5M`）上传的react组件；使用了mui ahooks tabler-icons等，支持并发分片上传和断点续传(需后端支持),为了安全起见,除了分片上传阶段,不会与s3服务器直接交互,分片上传阶段的直接交互应使用临时授权的preSignedUrl。当然可以通过传入自定义的s3PreUploadRequest、s3PartUploadRequest、s3CompleteUploadRequest等来实现自定义方式。

## 文件分片上传流程

默认情况下是分片上传：

文件校验(validate,使用fileCheck和isSameFile进行检查) => md5计算 => 初始化(preUpload,与后端交互) => 分片上传(partUpload,直接上传到s3服务器) => 合并文件(completeUpload,与后端交互) => 完成 


预处理阶段需要后端进行检查该文件是否已上传过（根据md5和文件size），如果：
- ①已上传过且完成了则直接返回相应信息
- ②已上传过但未完全上传则返回各分片的上传进度信息，其中未上传完成的分片会返回直接上传到s3的url
- ③未上传则直接创建分片上传任务，返回

注意：返回的分片任务是完整的PartNumber从1到Math.ceil(size/chunkSize)的任务信息

分片上传阶段会并发（默认为3）发起分片上传（允许暂停），全部完成后通知后端，后端会通知s3服务器合并,完成后后端返回url等信息

## 文件直接上传

当`directUpload`=`true`时，在文件大小不大于`directUploadMaxSize`(默认值为`4M`)会跳过分片上传和合并文件阶段。

文件校验(validate,使用fileCheck和isSameFile进行检查) => md5计算 => 初始化(preUpload,与后端交互,同时完成文件上传) => 完成 

## 效果图

![预览图][figure]

[figure]:data:image/png;base64,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

## Interface

完整类型见类型定义： src/interface/index.ts [https://github.com/liudichen/s3-uploader/blob/master/src/interface/index.ts]


单个文件条目的类型：
```typescript
interface UploadFile {
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
}
```

组件与子组件(每个文件)公用的部分props:

```typescript
interface S3RelateItemProps {
  /** 启用直接上传?(file.szie小于等于directUploadMaxSize)
   * @default false
   */
  directUpload?: boolean;
  /**
   * 直接上传最大文件大小
   * @default 1194304='4M'
   */
  directUploadMaxSize?: number;
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
```


父组件props:

```typescript
interface S3UploaderProps
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
```

## LICENSE

MIT
