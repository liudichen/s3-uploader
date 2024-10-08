"use client";

import { memo, useEffect, useRef } from "react";
import { useLatest, useMemoizedFn, useSafeState, useUpdate } from "ahooks";
import {
  Box,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import {
  IconChecks,
  IconCloudUpload,
  IconFileZip,
  IconLockSearch,
  IconMinus,
  IconPlayerPause,
  IconPrescription,
  IconTrash,
} from "@tabler/icons-react";

import { antdColor, defaultMaxDirectFileSize } from "../constants";
import { InnerFileIconRender } from "../components";
import type { S3PreUploadPart, UploadFileItemProps } from "../interface";

interface UploadPartTempFields {
  p?: number;
  err?: string;
}

export const UploadFileItem = memo((props: UploadFileItemProps) => {
  const {
    directUpload,
    directUploadMaxSize = defaultMaxDirectFileSize,
    chunkSize = 5242880,
    className,
    i,
    item,
    limit,
    onItemChange,
    readOnly,
    meta,
    uploader,
    uploaderName,
    chunkWaitTime,
    s3AbortUploadRequest,
    s3CompleteUploadRequest,
    s3PartUploadRequest,
    s3PreUploadRequest,
    s3CompleteUploadUrl,
    s3PreUploadUrl,
    urlConvert,
    FileIconRender = InnerFileIconRender,
    md5Getter,
    baseURL,
    timeout,
    platform,
    app,
    bucket,
    filePrefix,
    selectable,
    preview,
    PreviewRender,
  } = props;
  const md5AbortRef = useRef(false);
  /**是否全部完成 */
  const doneRef = useRef(item.done);
  /**有任务正在执行 */
  const doingRef = useRef(false);
  const [pause, setPause] = useSafeState(false);
  const pauseRef = useRef(false);
  const md5ProgressRef = useRef(0);
  const partsRef = useRef<(S3PreUploadPart & UploadPartTempFields)[]>(item?.parts || []);
  const uploadingPartsRef = useRef<(S3PreUploadPart & UploadPartTempFields)[]>([]);
  const forceUpdate = useUpdate();
  const uploadFailRef = useRef(false);
  const step = item?.s3 || !item?.step ? "完成" : item.step;

  const stepRef = useLatest(step);

  const error = !!item.err || uploadFailRef.current;

  const progressNum =
    step === "md5计算" || step === "初始化"
      ? 0
      : step === "完成"
      ? 100
      : +(partsRef.current.reduce((pre, cur) => pre + (cur.p || 0), 0) / (item.count || 1)).toFixed(2);

  const pauseSwitch = useMemoizedFn((pause?: any) => {
    if (step === "上传中") {
      const newPause = typeof pause === "boolean" ? pause : !pauseRef.current;
      if (!newPause && uploadFailRef) {
        uploadFailRef.current = false;
        onItemChange(i, "update", { ...item, err: "", errType: undefined });
      }
      pauseRef.current = newPause;
      setPause(newPause);
    }
  });

  const removeFile = useMemoizedFn(() => {
    md5AbortRef.current = true;
    doingRef.current = false;
    pauseSwitch(true);
    onItemChange(i, "delete");
  });

  const computeMd5 = useMemoizedFn(async () => {
    if (readOnly || (item.err && item.errType === "validate") || item.md5 || !item.file) {
      return;
    }

    const md5 = await md5Getter!(item.file, {
      abortRef: md5AbortRef,
      onprogress: (x) => {
        md5ProgressRef.current = x;
        forceUpdate();
      },
    });

    doneRef.current = false;
    if (md5 === false) {
      onItemChange(i, "update", { ...item, err: "计算文件校验和失败", errType: "md5", step: "md5计算" });
    } else if (typeof md5 === "string") {
      onItemChange(i, "update", { ...item, md5, err: "", errType: undefined, step: "初始化" });
    }
  });

  const preUpload = useMemoizedFn(async () => {
    if (readOnly || item.uploadId || !item.md5 || !item?.file?.size) {
      return;
    }

    const data = new FormData();
    data.append("platform", platform);
    data.append("fileName", item.file!.name);
    data.append("md5", item.md5!);
    if (item.file?.type) data.append("fileType", item.file!.type);
    data.append("size", item.file!.size as any);
    if (meta) data.append("meta", JSON.stringify(meta));
    if (uploader) data.append("uploader", uploader);
    if (uploaderName) data.append("uploaderName", uploaderName);
    if (app) data.append("app", app);
    if (bucket) data.append("bucket", bucket);
    if (filePrefix) data.append("prefix", filePrefix);
    if (directUpload && item.file.size <= directUploadMaxSize) {
      data.append("file", item.file);
    }

    try {
      const res = await s3PreUploadRequest!(s3PreUploadUrl, data, { baseURL, timeout, urlConvert });
      doneRef.current = res.done;

      const newItem = { ...item, ...res, err: "", errType: undefined };
      if (!res.done && !newItem.count) {
        newItem.count = Math.ceil(item.size / chunkSize);
      }
      if (!res.done) {
        newItem.step = "上传中";
      } else {
        newItem.step = "完成";
      }
      if (!res.done) {
        partsRef.current = res.parts!.map((ele) => ({ ...ele, p: ele.done ? 100 : 0 }));
      }
      onItemChange(i, "update", newItem);
    } catch (error: any) {
      console.log(`${item.name}-preUploadErr`, error);
      const errMsg = error?.message?.toString?.();
      onItemChange(i, "update", { ...item, err: `上传初始化失败${errMsg ? `-${errMsg}` : ""}`, errType: "preUpload" });
    }
  });

  const checkAndCompleteUpload = useMemoizedFn(async () => {
    if (item?.done || !partsRef.current?.length || doneRef.current) return;

    const allDone = partsRef.current.every((ele) => ele.done);

    if (!allDone) return;
    doingRef.current = false;
    onItemChange(i, "update", { ...item, step: "文件合并" });
  });

  const completeUpload = useMemoizedFn(async () => {
    if (readOnly) return;

    const allDone = partsRef.current.every((ele) => ele.done);
    if (!allDone) return;

    try {
      const result = await s3CompleteUploadRequest!(
        s3CompleteUploadUrl,
        {
          id: item.id!,
          uploadId: item.uploadId!,
          parts: partsRef.current.map((ele) => ({ PartNumber: ele.PartNumber, Size: ele.Size, ETag: ele.ETag! })),
        },
        { timeout, baseURL, urlConvert }
      );
      doneRef.current = true;
      const newItem = { ...item, ...(result || {}), done: true };
      delete newItem.parts;
      delete newItem.err;
      delete newItem.errType;
      partsRef.current = [];
      uploadingPartsRef.current = [];
      newItem.step = "完成";
      onItemChange(i, "update", newItem);
    } catch (error: any) {
      console.log("completeUploadErr", error);
      const errMsg = error?.message?.toString?.();
      uploadFailRef.current = true;
      onItemChange(i, "update", {
        ...item,
        err: `上传后文件合并出错${errMsg ? `-${errMsg}` : ""}`,
        errType: "completeUpload",
      });
    }
  });

  const partsUpload = useMemoizedFn(async () => {
    if (
      readOnly ||
      doingRef.current ||
      stepRef.current !== "上传中" ||
      uploadFailRef.current ||
      item.errType === "partUpload" ||
      doneRef.current ||
      !partsRef.current?.length
    ) {
      return;
    }

    if (partsRef.current.every((ele) => ele.done)) {
      await checkAndCompleteUpload();
    } else {
      doingRef.current = true;
      for (let i = 0; i < partsRef.current.length; i++) {
        if (uploadFailRef.current || !partsRef.current.length) break;

        const { done, PartNumber, url, Size } = partsRef.current[i];
        if (done || uploadingPartsRef.current?.some((ele) => ele.PartNumber === PartNumber)) {
          continue;
        }

        while (pauseRef.current || uploadingPartsRef.current.length >= limit!) {
          await new Promise((resolve) => setTimeout(resolve, chunkWaitTime));
        }

        if (uploadFailRef.current || pauseRef.current || !partsRef.current.length) {
          break;
        }

        if (partsRef.current[i].done || uploadingPartsRef.current?.some((ele) => ele.PartNumber === PartNumber)) {
          continue;
        }

        const start = (PartNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, item?.size || item?.file?.size || 0);

        uploadingPartsRef.current.push(partsRef.current[i]);

        partsRef.current[i].err = "";

        s3PartUploadRequest!(url!, item.file!.slice(start, end), {
          baseURL,
          timeout,
          urlConvert,
          onUploadProgress(e) {
            partsRef.current[i].p = Math.floor((e.loaded * 100) / Size);
            forceUpdate();
          },
        })
          .then(async () => {
            partsRef.current[i].err = "";
            partsRef.current[i].done = 1;
            await checkAndCompleteUpload();
          })
          .catch((reason: Error) => {
            const errMsg = reason?.message?.toString?.();
            const err = `上传分片-${PartNumber}出错${errMsg ? `(${errMsg})` : ""}`;
            console.log(`${item?.file?.name}-${PartNumber}-PartUploadFail:`, reason);
            partsRef.current[i].err = err;
            uploadFailRef.current = true;
            onItemChange(i, "update", { ...item, err, errType: "partUpload" });
          })
          .finally(() => {
            const index = uploadingPartsRef.current.findIndex((ele) => ele.PartNumber === PartNumber);
            if (index !== -1) uploadingPartsRef.current.splice(index, 1);
          });
      }
    }
  });

  useEffect(() => {
    if (step === "md5计算") {
      computeMd5();
    } else if (step === "初始化") {
      preUpload();
    } else if (step === "上传中") {
      partsUpload();
    } else if (step === "文件合并") {
      completeUpload();
    }
  }, [step]);

  return (
    <Box
      display="flex"
      flexDirection="row"
      alignItems="center"
      sx={{ borderRadius: 2, border: `1px solid ${error ? antdColor.error : antdColor.gray5}` }}
      className={className}
    >
      <FormControlLabel
        sx={{ mr: 0.5, ml: 0 }}
        control={
          !selectable ? (
            <></>
          ) : (
            <Checkbox
              disabled={readOnly || !item.done}
              checked={item.checked}
              onChange={() => onItemChange(i, "select")}
            />
          )
        }
        label={`${i + 1}.`}
      />
      <Box sx={{ mx: 0.25 }} className="s3-uploader-item-icon">
        <FileIconRender item={item} preview={preview} PreviewRender={PreviewRender} />
      </Box>
      <Box sx={{ px: 0.25, width: "100%", overflow: "hidden" }} className="s3-uploader-item-content">
        <Box
          sx={{ pt: 0.25, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
          className="s3-uploader-item-title"
        >
          <Typography variant="body2" title={item.name}>
            {item.name}
          </Typography>
        </Box>
        {!readOnly && (step === "md5计算" || step === "上传中") && (
          <Box display="flex" alignItems="center" className="s3-uploader-item-progress">
            {step === "md5计算" ? (
              <LinearProgress
                title={`文件校验进度:${md5ProgressRef.current}%`}
                sx={{ flex: 1, mr: 0.1 }}
                value={md5ProgressRef.current}
                variant="determinate"
                color={error ? "error" : "secondary"}
              />
            ) : (
              <LinearProgress
                sx={{ flex: 1, mr: 0.1 }}
                value={progressNum}
                variant="determinate"
                color={error ? "error" : "primary"}
              />
            )}
            <Box sx={{ minWidth: 42, textAlign: "right" }}>
              <Typography variant="body2">{step === "md5计算" ? md5ProgressRef.current : progressNum}%</Typography>
            </Box>
          </Box>
        )}
      </Box>
      {!readOnly && (
        <Stack
          className="s3-uploader-item-actions"
          direction="row"
          alignItems="center"
          justifyContent="center"
          sx={{
            mx: 0.5,
          }}
        >
          {step === "完成" && (
            <IconButton
              title="文件已成功上传"
              size="small"
              sx={{
                border: `2px solid ${item?.s3 ? antdColor.gray6 : antdColor.success}`,
                p: 0.25,
                zIndex: 100,
              }}
            >
              <IconChecks color={item?.s3 ? antdColor.gray6 : antdColor.success} />
            </IconButton>
          )}
          {step === "文件校验" && (
            <Box sx={{ position: "relative" }} className="s3-uploader-item-action">
              <IconButton
                title={item.err || "文件校验失败"}
                size="small"
                sx={{
                  zIndex: 100,
                  p: 0.25,
                }}
              >
                <IconMinus color={antdColor.warning} />
                <CircularProgress
                  size={36}
                  variant="determinate"
                  value={100}
                  sx={{
                    color: antdColor.warning,
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    marginTop: "-18px",
                    marginLeft: "-18px",
                    zIndex: 0,
                  }}
                />
              </IconButton>
            </Box>
          )}
          {step === "md5计算" && !!item.file && (
            <Box sx={{ position: "relative" }} className="s3-uploader-item-action">
              <IconButton
                size="small"
                title={item.err || `文件校验中...`}
                sx={{
                  zIndex: 100,
                  p: 0.25,
                  border: item.err ? `2px solid ${antdColor.warning}` : undefined,
                }}
              >
                <IconLockSearch color={item.err ? antdColor.warning : antdColor.blue3} />
              </IconButton>
              {!item.err && (
                <CircularProgress
                  size={36}
                  sx={{
                    color: antdColor.blue3,
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    marginTop: "-18px",
                    marginLeft: "-18px",
                    zIndex: 0,
                  }}
                />
              )}
            </Box>
          )}
          {step === "初始化" && (
            <Box sx={{ position: "relative" }} className="s3-uploader-item-action">
              <IconButton
                size="small"
                onClick={preUpload}
                title={`上传初始化中,初始化上传任务...${item.err ? `(Error-${item.err})` : ""}`}
                sx={{ zIndex: 100, p: 0.25 }}
              >
                <IconPrescription color={item.errType === "preUpload" ? antdColor.warning : antdColor.cyan} />
              </IconButton>
              <CircularProgress
                size={36}
                variant={item.err ? "determinate" : "indeterminate"}
                value={100}
                sx={{
                  color: item.err ? antdColor.warning : antdColor.cyan,
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  marginTop: "-18px",
                  marginLeft: "-18px",
                  zIndex: 0,
                }}
              />
            </Box>
          )}
          {step === "上传中" && (
            <Box sx={{ position: "relative" }} className="s3-uploader-item-action">
              <IconButton
                size="small"
                title={`上传${pause ? "暂停" : ""}中,点击${pause ? "继续" : "暂停"}${
                  uploadFailRef.current ? `(Error-${item.err})` : ""
                }`}
                onClick={pauseSwitch}
                sx={{ zIndex: 100, p: 0.25 }}
              >
                {pause ? (
                  <IconPlayerPause color={antdColor.warning} />
                ) : (
                  <IconCloudUpload color={item.errType === "partUpload" ? antdColor.warning : antdColor.primary} />
                )}
              </IconButton>{" "}
              {!uploadFailRef.current && !pause && (
                <CircularProgress
                  size={36}
                  sx={{
                    color: antdColor.primary,
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    marginTop: "-18px",
                    marginLeft: "-18px",
                    zIndex: 0,
                  }}
                />
              )}
            </Box>
          )}
          {step === "文件合并" && (
            <Box sx={{ position: "relative" }} className="s3-uploader-item-action">
              <IconButton size="small" title={item.err || "文件合并中"} sx={{ zIndex: 100, p: 0.25 }}>
                <IconFileZip color={error ? antdColor.warning : antdColor.purple} />
              </IconButton>
              <CircularProgress
                size={36}
                value={100}
                variant={error ? "determinate" : "indeterminate"}
                sx={{
                  color: antdColor.purple,
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  marginTop: "-18px",
                  marginLeft: "-18px",
                  zIndex: 0,
                }}
              />
            </Box>
          )}
          <IconButton title="移除" onClick={removeFile} sx={{ zIndex: 100 }}>
            <IconTrash color={antdColor.error} />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
});
