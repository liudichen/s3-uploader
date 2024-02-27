import { type ComponentType, type ReactNode } from "react";
import { useControllableValue, useMemoizedFn } from "ahooks";
import { Stack, SxProps } from "@mui/material";
import { type DropzoneOptions } from "react-dropzone";

import { antdColor } from "./constants";
import { isSameFile } from "./utils";
import { UploadZone } from "./UploadZone";
import { UploadItem } from "./UploadItem";
import { Trigger } from "./Trigger";
import type { OnItemChangeFn, UploadFile, UrlConvertFn } from "./interface";

export interface S3UploaderIProps {
  value?: UploadFile[];
  onChange?: (v: UploadFile[]) => void;
  defaultValue?: UploadFile[];

  className?: string;
  s3PreUploadUrl: string;
  s3CompleteUploadUrl: string;
  s3AbortUploadUrl?: string;
  getFileIcon: (fileName: string, mimeType?: string) => ComponentType<{ size?: number }>;
  uploadZoneClassName?: string;
  uploadItemClassName?: string;

  meta?: Record<string, number | string>;
  uploader?: string;
  uploaderName?: string;
  error?: boolean;
  /**分片上传并发数量限制 */
  limit?: number;
  /**分片上传后端返回的url的转换函数 */
  partUrlConvert?: UrlConvertFn;
  /**达到并发限制时,等待多少ms再次进行检查是否达到并发数量限制 */
  chunkWaitTime?: number;
  /**触发DropZone的元素节点 */
  dropZoneTrigger?: ReactNode;
  dropZoneSx?: SxProps;
  accept?: DropzoneOptions["accept"];
  minSize?: number;
  maxSize?: number;
  maxFiles?: number;
  preventDropOnDocument?: boolean;
  noClick?: boolean;
  noKeyboard?: boolean;
  noDrag?: boolean;
  noDragEventsBubbling?: boolean;
  useFsAccessApi?: boolean;
  autoFocus?: boolean;
}

export const S3Uploader = (props: S3UploaderIProps) => {
  const {
    meta,
    uploader,
    uploaderName,
    limit = 3,
    partUrlConvert,
    chunkWaitTime = 1000,
    dropZoneTrigger,
    maxFiles,
    dropZoneSx,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    value: valueProp,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onChange: onChagneProp,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    defaultValue: defaultValueProp,
    s3CompleteUploadUrl,
    s3PreUploadUrl,
    s3AbortUploadUrl,
    getFileIcon,
    uploadItemClassName,
    uploadZoneClassName,
    className,
    ...restProps
  } = props;
  const [value, setValue] = useControllableValue<UploadFile[]>(props, { defaultValue: [] });

  const readOnly = false;

  const onDropAccepted: DropzoneOptions["onDropAccepted"] = useMemoizedFn((acceptedFiles) => {
    if (readOnly) return;
    const rawFiles = value || [];
    const rawN = rawFiles?.length || 0;
    if (!acceptedFiles?.length || (!!maxFiles && rawN >= maxFiles)) return;
    const newFiles: UploadFile[] = [];
    for (let i = 0; i < acceptedFiles.length; i++) {
      if (!!maxFiles && newFiles.length + rawN >= maxFiles) {
        break;
      }
      const file = acceptedFiles[i];
      if (rawFiles?.some((ele) => isSameFile(ele.file, file)) || newFiles.some((ele) => isSameFile(ele.file, file))) {
        continue;
      }
      const item: UploadFile = {
        file,
        size: file.size,
      };

      newFiles.push(item);
    }
    if (!newFiles.length) return;
    const newValue = [...(rawFiles || [])];
    newValue.push(...(maxFiles ? newFiles.slice(0, maxFiles - rawN) : newFiles));

    setValue(newValue);
  });

  const onItemChange: OnItemChangeFn = useMemoizedFn((i, task, newItem) => {
    const newValue = [...(value || [])];
    if (task === "delete") {
      newValue.splice(i, 1);
    } else {
      if (newItem!.md5 && newValue.some((ele, index) => ele.md5 === newItem!.md5 && index !== i)) {
        newValue.splice(i, 1);
      } else {
        newValue[i] = newItem!;
      }
    }
    setValue(newValue);
  });

  return (
    <Stack
      spacing={0.5}
      direction="column"
      sx={{
        width: "100%",
        border: `1px solid ${antdColor.gray4}`,
        p: 0.25,
        borderRadius: 1,
      }}
      className={className}
    >
      {!readOnly && (!maxFiles || maxFiles > (value?.length || 0)) && (
        <UploadZone
          multiple={maxFiles !== 1}
          onDropAccepted={onDropAccepted}
          maxFiles={maxFiles}
          {...restProps}
          className={uploadZoneClassName}
        >
          {dropZoneTrigger || <Trigger />}
        </UploadZone>
      )}
      {value?.map((item, i) => (
        <UploadItem
          i={i}
          item={item}
          key={item?.md5 || `${i}-${item.file.name}`}
          onItemChange={onItemChange}
          uploader={uploader}
          uploaderName={uploaderName}
          meta={meta}
          readOnly={readOnly}
          limit={limit}
          partUrlConvert={partUrlConvert}
          chunkWaitTime={chunkWaitTime}
          s3CompleteUploadUrl={s3CompleteUploadUrl}
          s3PreUploadUrl={s3PreUploadUrl}
          s3AbortUploadUrl={s3AbortUploadUrl}
          getFileIcon={getFileIcon}
          className={uploadItemClassName}
        />
      ))}
    </Stack>
  );
};
