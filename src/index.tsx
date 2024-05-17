"use client";

import { flushSync } from "react-dom";
import { useControllableValue, useMemoizedFn } from "ahooks";
import { Stack } from "@mui/material";
import type { DropzoneOptions } from "react-dropzone";

import {
  antdColor,
  defaultMaxDirectFileSize,
  isSameFileFn,
  md5GetterFn,
  s3AbortUploadRequestFn,
  s3CompleteUploadRequestFn,
  s3PartUploadRequestFn,
  s3PreUploadRequestFn,
} from "./constants";
import { UploadZone } from "./UploadZone";
import { UploadFileItem } from "./UploadFileItem";
import type { OnItemChangeFn, S3UploaderProps, UploadFile } from "./interface";
import { Trigger } from "./Trigger";
import { InnerFileIconRender } from "./components";

export const S3Uploader = (props: S3UploaderProps) => {
  const {
    value: valueProp,
    onChange,
    defaultValue,
    meta,
    uploader,
    uploaderName,
    chunkSize = 5242880,
    limit = 3,
    chunkWaitTime = 1000,
    fileChecker,
    FileIconRender = InnerFileIconRender,
    disabled,
    dropZoneTrigger = <Trigger />,
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
    timeout = 15000,
    platform,
    app,
    filePrefix,
    bucket,
    selectType,
    selectable,
    preview,
    PreviewRender,
    directUpload = false,
    directUploadMaxSize = defaultMaxDirectFileSize,
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

      const item: UploadFile = {
        file,
        size: file.size,
        name: file.name,
        type: file.type,
        checked: false,
        step: "md5计算",
      };

      if (fileChecker) {
        const checkResultErrMsg = await fileChecker(file);
        if (checkResultErrMsg) {
          item.err = checkResultErrMsg;
          item.errType = "validate";
          item.step = "文件校验";
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

    flushSync(() => {
      setValue(newValue);
    });
  });

  const onItemChange: OnItemChangeFn = useMemoizedFn((i, task, newItem) => {
    flushSync(() => {
      if (task === "delete") {
        setValue((st) => {
          const newValue = [...(st || [])];
          newValue.splice(i, 1);
          return newValue;
        });
      } else if (task === "select") {
        setValue((st) => {
          const newValue = [...(st || [])];
          const checked = !newValue[i].checked;
          newValue[i].checked = checked;
          if (checked && selectType === "single") {
            for (let j = 0; j < newValue.length; j++) {
              if (j !== i) newValue[j].checked = false;
            }
          }
          return newValue;
        });
      } else {
        setValue((st) => {
          const newValue = [...(st || [])];
          newValue[i] = newItem!;
          return newValue;
        });
      }
    });
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
        >
          {dropZoneTrigger}
        </UploadZone>
      )}
      {value?.map((item, i) => (
        <UploadFileItem
          key={`${item.name}-${item.size}`}
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
          FileIconRender={FileIconRender}
          baseURL={baseURL}
          timeout={timeout}
          className={uploadItemClassName}
          platform={platform}
          app={app}
          bucket={bucket}
          filePrefix={filePrefix}
          selectType={selectType}
          selectable={selectable}
          preview={preview}
          PreviewRender={PreviewRender}
          chunkSize={chunkSize}
          directUpload={directUpload}
          directUploadMaxSize={directUploadMaxSize}
        />
      ))}
    </Stack>
  );
};

export * from "./interface";
