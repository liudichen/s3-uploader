import { useControllableValue, useMemoizedFn } from "ahooks";
import { Stack } from "@mui/material";
import { DropzoneOptions } from "react-dropzone";

import {
  antdColor,
  fileIconRenderFn,
  isSameFileFn,
  md5GetterFn,
  s3AbortUploadRequestFn,
  s3CompleteUploadRequestFn,
  s3PartUploadRequestFn,
  s3PreUploadRequestFn,
} from "./constants";
import { UploadZone } from "./UploadZone";
import { UploadFileItem } from "./UploadFileItem";
import type { OnItemChangeFn, S3UploaderIProps, UploadFile } from "./interface";

export const S3Uploader = (props: S3UploaderIProps) => {
  const {
    value: valueProp,
    onChange,
    defaultValue,
    meta,
    uploader,
    uploaderName,
    limit = 3,
    chunkWaitTime = 1000,
    fileChecker,
    fileIconRender = fileIconRenderFn,
    disabled,
    dropZoneSx,
    dropZoneTrigger,
    uploadItemClassName,
    uploadZoneClassName,
    className,
    s3AbortUploadRequest = s3AbortUploadRequestFn,
    s3CompleteUploadRequest = s3CompleteUploadRequestFn,
    s3PartUploadRequest = s3PartUploadRequestFn,
    s3PreUploadRequest = s3PreUploadRequestFn,
    s3CompleteUploadUrl,
    s3PreUploadUrl,
    s3AbortUploadUrl,
    urlConvert,
    maxFiles,
    error,
    readOnly: readOnlyProp,
    onDropAccepted: onDropAcceptedProp,
    isSameFile = isSameFileFn,
    md5Getter = md5GetterFn,
    baseURL,
    timeout,
    ...restProps
  } = props;

  const readOnly = !!readOnlyProp || !!disabled;
  const [value, setValue] = useControllableValue<UploadFile[]>(props, { defaultValue: [] });

  const onDropAccepted: DropzoneOptions["onDropAccepted"] = useMemoizedFn(async (acceptFiles: File[], e) => {
    if (readOnly) return;
    const rawFiles = value || [];
    const rawCount = rawFiles?.length || 0;

    if (!acceptFiles?.length || (!!maxFiles && rawCount >= maxFiles)) {
      return;
    }

    const candidateFiles = onDropAcceptedProp ? await onDropAcceptedProp(acceptFiles, e) : acceptFiles;

    if (!candidateFiles?.length) return;

    const newFiles: UploadFile[] = [];

    for (let i = 0; i < candidateFiles.length; i++) {
      const file = candidateFiles[i];
      if (isSameFile) {
        if (
          rawFiles?.some((ele) => isSameFile(file, ele?.file)) ||
          newFiles.some((ele) => isSameFile(file, ele.file!))
        ) {
          continue;
        }
      }

      const item: UploadFile = { file, size: file.size, name: file.name, type: file.type };

      if (fileChecker) {
        const checkResultErrMsg = await fileChecker(file);
        if (checkResultErrMsg) {
          item.err = checkResultErrMsg;
          item.errType = "validate";
        }
      }

      newFiles.push(item);

      if (!!maxFiles && rawCount + newFiles.length >= maxFiles) {
        break;
      }
    }

    if (!newFiles.length) return;

    const newValue = [...(rawFiles || [])];
    newValue.push(...(maxFiles ? newFiles.slice(0, maxFiles - rawCount) : newFiles));

    setValue(newValue);
  });

  const onItemChange: OnItemChangeFn = useMemoizedFn((i, task, newItem) => {
    const newValue = [...(value || [])];
    if (task === "delete") {
      newValue.splice(i, 1);
    } else if (newItem?.md5) {
      const index = newValue.findIndex(
        (ele) => ele.md5 === newItem.md5 || (newItem.name === ele.name && newItem.size === ele.size)
      );
      if (index === -1) return;
      if (newValue.some((ele, index) => ele.md5 === newItem.md5 && index !== i)) {
        newValue.splice(i, 1);
      } else {
        newValue[i] = newItem;
      }
    } else {
      newValue[i] = newItem!;
    }
    setValue(newValue);
  });

  return (
    <Stack
      spacing={0.5}
      direction="column"
      sx={{ width: "100%", border: `1px solid ${antdColor.gray4}`, p: 0.25, borderRadius: 1 }}
      className={className}
    >
      {!readOnly && (!maxFiles || maxFiles > (value?.length || 0)) && (
        <UploadZone
          multiple={maxFiles !== 1}
          maxFiles={maxFiles}
          disabled={readOnly}
          onDropAccepted={onDropAccepted}
          {...restProps}
          className={uploadZoneClassName}
        />
      )}
      {value?.map((item, i) => (
        <UploadFileItem
          key={item.md5 || `${item.name}-${item.size}`}
          i={i}
          item={item}
          limit={limit}
          onItemChange={onItemChange}
          readOnly={readOnly}
          meta={meta}
          uploader={uploader}
          uploaderName={uploaderName}
          chunkWaitTime={chunkWaitTime}
          s3PreUploadRequest={s3PreUploadRequest}
          s3PreUploadUrl={s3PreUploadUrl}
          s3PartUploadRequest={s3PartUploadRequest}
          s3CompleteUploadRequest={s3CompleteUploadRequest}
          s3CompleteUploadUrl={s3CompleteUploadUrl}
          s3AbortUploadRequest={s3AbortUploadRequest}
          s3AbortUploadUrl={s3AbortUploadUrl}
          md5Getter={md5Getter}
          urlConvert={urlConvert}
          fileIconRender={fileIconRender}
          baseURL={baseURL}
          timeout={timeout}
          className={uploadItemClassName}
        />
      ))}
    </Stack>
  );
};
