import { useEffect, useRef } from "react";
import { useLatest, useMemoizedFn, useSafeState, useUpdate } from "ahooks";
import { Box, CircularProgress, IconButton, LinearProgress, Stack, Typography } from "@mui/material";
import {
  IconChecks,
  IconCloudUpload,
  IconLockSearch,
  IconPlayerPause,
  IconPrescription,
  IconTrash,
} from "@tabler/icons-react";

import { antdColor } from "../constants";
import type { FileUploadStep, S3PreUploadPart, UploadFileItemProps } from "../interface";

const chunkSize = 5 * 1024 * 1024;

interface UploadPartTempFields {
  p?: number;
  err?: string;
}

export const UploadFileItem = ({
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
  fileIconRender,
  md5Getter,
  baseURL,
  timeout,
  platform,
  app,
  bucket,
  filePrefix,
}: UploadFileItemProps) => {
  const md5AbortRef = useRef(false);
  /**是否全部完成 */
  const doneRef = useRef(false);
  /**有任务正在执行 */
  const doingRef = useRef(false);
  const [pause, setPause] = useSafeState(false);
  const pauseRef = useRef(false);
  const md5ProgressRef = useRef(0);
  const partsRef = useRef<(S3PreUploadPart & UploadPartTempFields)[]>(item?.parts || []);
  const uploadingPartsRef = useRef<(S3PreUploadPart & UploadPartTempFields)[]>([]);
  const forceUpdate = useUpdate();
  const uploadFailRef = useRef(false);

  const step: FileUploadStep = !item?.md5 ? "md5计算" : !item?.uploadId ? "初始化" : item?.done ? "完成" : "上传中";

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
        onItemChange(i, "update", { ...item, err: "", errType: undefined });
        uploadFailRef.current = false;
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
    if (readOnly || doingRef.current || (item.err && item.errType === "validate") || item.md5 || !item.file) return;

    doingRef.current = true;
    const md5 = await md5Getter!(item.file, {
      abortRef: md5AbortRef,
      onprogress: (x) => {
        md5ProgressRef.current = x;
        forceUpdate();
      },
    });

    doneRef.current = false;
    if (md5 === false) {
      onItemChange(i, "update", { ...item, err: "计算文件校验和失败", errType: "md5" });
    } else if (typeof md5 === "string") {
      onItemChange(i, "update", { ...item, md5, err: "", errType: undefined });
    }
  });

  const preUpload = useMemoizedFn(async () => {
    if (readOnly || item.uploadId) {
      return;
    }
    try {
      doingRef.current = true;
      const res = await s3PreUploadRequest!(
        s3PreUploadUrl,
        {
          fileName: item.file!.name,
          md5: item.md5!,
          fileType: item.file!.type,
          size: item.file!.size,
          meta,
          uploader,
          uploaderName,
          platform,
          app,
          bucket,
          prefix: filePrefix,
        },
        { baseURL, timeout, urlConvert }
      );
      doneRef.current = res.done;
      if (!res.done) {
        partsRef.current = res.parts!.map((ele) => ({ ...ele, p: ele.done ? 100 : 0 }));
      }
      doingRef.current = false;
      onItemChange(i, "update", { ...item, ...res, err: "", errType: undefined });
    } catch (error) {
      doingRef.current = false;
      console.log(`${item.name}-preUploadErr`, error);
      onItemChange(i, "update", { ...item, err: "上传初始化失败", errType: "preUpload" });
    }
  });

  const checkAndCompleteUpload = useMemoizedFn(async () => {
    if (item?.done || !partsRef.current?.length || doneRef.current) return;

    const allDone = partsRef.current.every((ele) => ele.done);
    if (!allDone) return;
    doingRef.current = false;
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
      const newItem = { ...item, done: true, url: result.url };
      delete newItem.parts;
      delete newItem.err;
      delete newItem.errType;
      partsRef.current = [];
      uploadingPartsRef.current = [];
    } catch (error) {
      console.log("completeUploadErr", error);
      const err = "上传后文件合并出错";
      uploadFailRef.current = true;
      onItemChange(i, "update", { ...item, err, errType: "completeUpload" });
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

        partsRef.current[PartNumber - 1].err = "";

        s3PartUploadRequest!(url!, item.file!.slice(start, end), {
          baseURL,
          timeout,
          urlConvert,
          onUploadProgress(e) {
            partsRef.current[PartNumber - 1].p = Math.floor((e.loaded * 100) / Size);
            forceUpdate();
          },
        })
          .then(async () => {
            partsRef.current[PartNumber - 1].err = "";
            partsRef.current[PartNumber - 1].done = 1;
            await checkAndCompleteUpload();
          })
          .catch((reason: any) => {
            const err = `上传分片-${PartNumber}出错`;
            console.log(`${item?.file?.name}-${PartNumber}-PartUploadFail:`, reason);
            partsRef.current[PartNumber - 1].err = err;
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
    } else if (step === "上传中" && !doneRef.current) {
      partsUpload();
    }
  }, [step, pause]);

  return (
    <Box
      display="flex"
      flexDirection="row"
      alignItems="center"
      sx={{ borderRadius: 2, border: `1px solid ${antdColor.gray5}` }}
      className={className}
    >
      <Box sx={{ mx: 0.25 }} className="s3-uploader-item-icon">
        {fileIconRender!(item)}
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
        {!readOnly && (
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
                border: `2px solid ${antdColor.success}`,
                p: 0.25,
                zIndex: 100,
              }}
            >
              <IconChecks color={antdColor.success} />
            </IconButton>
          )}
          {step === "md5计算" && !!item.file && (
            <Box sx={{ position: "relative" }} className="s3-uploader-item-action">
              <IconButton
                size="small"
                title={item.err || `文件校验中...`}
                sx={{
                  zIndex: 100,
                  p: 0.25,
                  border: item.err ? `2px solid ${antdColor.error}` : undefined,
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
                onClick={() => console.log(Date.now())}
                title={`上传初始化中,初始化上传任务...${item.err ? `(Error-${item.err})` : ""}`}
                sx={{ zIndex: 100, p: 0.25 }}
              >
                <IconPrescription color={item.errType === "preUpload" ? antdColor.warning : antdColor.cyan} />
              </IconButton>
              {!item.err && (
                <CircularProgress
                  size={36}
                  sx={{
                    color: antdColor.cyan,
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
          <IconButton title="移除" onClick={removeFile} sx={{ zIndex: 100 }}>
            <IconTrash color={antdColor.error} />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
};
