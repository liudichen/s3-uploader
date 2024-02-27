import { type ComponentType, useEffect, useRef } from "react";
import { useMemoizedFn, useSafeState, useUpdate } from "ahooks";
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
import { getFileIcon as defaultGetFileIcon, getFileMd5, s3Request } from "../utils";
import type {
  XhrFailResponse,
  OnItemChangeFn,
  S3CompleteUploadData,
  S3PreUploadPart,
  UploadFile,
  UrlConvertFn,
  S3PreUploadData,
  S3PreUploadResponse,
} from "../interface";

interface UploadItemProps {
  error?: boolean;
  i: number;
  item: UploadFile;
  limit?: number;
  onItemChange: OnItemChangeFn;
  readOnly?: boolean;
  /**part的url的转化函数 */
  partUrlConvert?: UrlConvertFn;
  meta?: Record<string, number | string>;
  uploader?: string;
  uploaderName?: string;
  chunkWaitTime?: number;
  s3PreUploadUrl: string;
  s3CompleteUploadUrl: string;
  s3AbortUploadUrl?: string;
  getFileIcon: (fileName: string, mimeType?: string) => ComponentType<{ size?: number }>;
  className?: string;
}

type FileUploadStep = "md5计算" | "初始化" | "上传中" | "完成";

const chunkSize = 5 * 1024 * 1024;

interface UploadPartTempFields {
  p?: number;
  err?: string;
}

export const UploadItem = ({
  i,
  item,
  limit = 3,
  onItemChange,
  readOnly,
  partUrlConvert,
  meta,
  uploader,
  uploaderName,
  chunkWaitTime = 1000,
  error,
  s3AbortUploadUrl,
  s3CompleteUploadUrl,
  s3PreUploadUrl,
  getFileIcon = defaultGetFileIcon,
  className,
}: UploadItemProps) => {
  const jobRef = useRef(false);
  const { file, count, err } = item || {};
  const { name: fileName, type: mimeType } = file || {};
  const md5AbortRef = useRef(false);
  const doneRef = useRef(false);
  const [pause, setPause] = useSafeState(false);
  const pauseRef = useRef(false);
  const [errMsg, setErrMsg] = useSafeState("");
  const uploadErrorRef = useRef(false);
  const md5ProgressRef = useRef(0);
  const partsRef = useRef<(S3PreUploadPart & UploadPartTempFields)[]>(item?.parts || []);
  const uploadingParts = useRef<(S3PreUploadPart & UploadPartTempFields)[]>([]);
  const forceUpdate = useUpdate();

  const FileIcon = getFileIcon(fileName, mimeType);

  const step: FileUploadStep = !item?.md5
    ? "md5计算"
    : !item?.uploadId
    ? "初始化"
    : item?.done || doneRef.current
    ? "完成"
    : "上传中";

  const stepRef = useRef(step);

  const hasError = error || !!err || uploadErrorRef.current;

  const setUploadError = useMemoizedFn((err?: string) => {
    uploadErrorRef.current = !!err;
    setErrMsg(err || "");
  });

  const switchPause = useMemoizedFn((pause) => {
    if (step === "上传中") {
      const newPause = typeof pause === "boolean" ? pause : !pauseRef.current;
      if (!newPause && uploadErrorRef.current) {
        setUploadError();
      }
      pauseRef.current = newPause;
      setPause(newPause);
    }
  });

  const progressNum =
    step === "md5计算" || step === "初始化"
      ? 0
      : step === "完成"
      ? 100
      : +(partsRef.current.reduce((pre, cur) => pre + (cur.p || 0), 0) / (count || 1)).toFixed(2);

  const checkAllUploadDone = useMemoizedFn(async (done?: true) => {
    if (item?.done || !partsRef.current?.length || doneRef.current) return;

    const allUploadDone = done || partsRef.current.every((ele) => ele.done);

    if (!allUploadDone) return;

    const data: S3CompleteUploadData = {
      id: item.id!,
      uploadId: item.uploadId!,
      parts: partsRef.current.map((ele) => ({ PartNumber: ele.PartNumber, Size: ele.Size, ETag: ele.ETag! })),
    };
    try {
      await s3Request("completeUpload", s3CompleteUploadUrl, JSON.stringify(data));
      doneRef.current = true;
      onItemChange(i, "update", { ...item, done: true });
    } catch (error) {
      console.log("completeUploadErr", error);
      const err = "上传后文件合并出错";
      setUploadError(err);
      onItemChange(i, "update", { ...item, err });
    }
  });

  const startUpload = useMemoizedFn(async () => {
    if (stepRef.current !== "上传中" || doneRef.current || !partsRef.current?.length) return;

    if (partsRef.current.every((ele) => ele.done)) {
      await checkAllUploadDone(true);
    } else {
      for (let i = 0; i < partsRef.current.length; i++) {
        if (uploadErrorRef.current || pauseRef.current) break;

        const part = partsRef.current[i];
        const { done, PartNumber, url, Size } = part;
        if (done || uploadingParts.current?.some((ele) => ele.PartNumber === PartNumber)) continue;

        while (uploadingParts.current.length >= limit) {
          await new Promise((resolve) => setTimeout(resolve, chunkWaitTime || 1000));
        }

        if (uploadErrorRef.current || pauseRef.current) break;
        if (done || uploadingParts.current?.some((ele) => ele.PartNumber === PartNumber)) continue;

        if (partsRef.current[i].done || uploadingParts.current.some((ele) => ele.PartNumber === PartNumber)) {
          continue;
        }

        const start = (PartNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, item?.size || item?.file?.size || 0);

        uploadingParts.current.push(partsRef.current[i]);

        s3Request(
          "uploadPart",
          partUrlConvert && typeof partUrlConvert === "function" ? partUrlConvert(url!) : url!,
          item.file.slice(start, end),
          {
            onprogress(e) {
              partsRef.current[PartNumber - 1].p = Math.floor((e.loaded * 100) / Size);
              forceUpdate();
            },
          }
        )
          .then(() => {
            partsRef.current[PartNumber - 1].err = "";
            partsRef.current[PartNumber - 1].done = 1;
            checkAllUploadDone();
          })
          .catch((reason: XhrFailResponse) => {
            const err = `上传分片-${PartNumber}出错`;
            console.log(`${item?.file?.name}-${PartNumber}-PartUploadFail:`, reason);
            partsRef.current[PartNumber - 1].err = err;
            setUploadError(err);
          })
          .finally(() =>
            uploadingParts.current.splice(
              uploadingParts.current.findIndex((ele) => ele.PartNumber === PartNumber),
              1
            )
          );
      }
    }
  });

  const remove = useMemoizedFn(() => {
    md5AbortRef.current = true;
    switchPause(true);
    onItemChange(i, "delete");
  });

  const initFileItem = useMemoizedFn(async (item: UploadFile) => {
    const { file, md5, uploadId } = item || {};
    if (!item || readOnly || (!!md5 && !!uploadId)) return;

    let newItem = { ...item };

    doneRef.current = false;
    pauseRef.current = false;
    newItem.err = "";

    if (!md5) {
      if (jobRef.current) return;
      jobRef.current = true;
      md5AbortRef.current = false;
      const fileMd5 = await getFileMd5(file, {
        abortRef: md5AbortRef,
        onprogress: (x) => {
          md5ProgressRef.current = x;
          forceUpdate();
        },
      });
      jobRef.current = false;
      if (fileMd5 === false) {
        newItem.err = "获取文件校验和失败";
      } else if (fileMd5 === 0) {
        return;
      } else {
        newItem.md5 = fileMd5;
      }
    } else if (!item.uploadId) {
      if (jobRef.current) return;
      const data: S3PreUploadData = {
        fileName: file.name,
        md5,
        fileType: file.type,
        size: file.size,
        meta,
        uploader,
        uploaderName,
      };
      try {
        jobRef.current = true;
        const res = await s3Request<S3PreUploadResponse>("preUpload", s3PreUploadUrl, JSON.stringify(data));
        newItem = { ...newItem, ...res };
        doneRef.current = res.done;
        if (!doneRef.current) {
          partsRef.current = res.parts!.map((ele) => ({ ...ele, p: ele.done ? 100 : 0 }));
        }
      } catch (error: any) {
        console.log(`${file.name}-preUploadErr`, error);
        newItem.err = `${file.name}-${error?.message || "获取上传信息失败"}}`;
      }
      jobRef.current = false;
    }
    onItemChange(i, "update", newItem);
  });

  useEffect(() => {
    initFileItem(item);
  }, [item]);

  useEffect(() => {
    if (stepRef.current !== step) {
      stepRef.current = step;
    }
    if (stepRef.current === "上传中" && !doneRef.current) {
      startUpload();
    }
  }, [step, pause]);

  return (
    <Box
      display="flex"
      alignItems="center"
      flexDirection="row"
      sx={{
        border: `1px solid ${hasError ? antdColor.error : antdColor.gray5}`,
        borderRadius: 2,
      }}
      className={className}
    >
      <Box sx={{ mx: 0.25 }} className="s3-uploader-item-icon">
        <FileIcon size={24} />
      </Box>
      <Box sx={{ px: 0.25, width: "100%", overflow: "hidden" }} className="s3-uploader-item-content">
        <Box
          sx={{ pt: 0.25, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}
          className="s3-uploader-item-title"
        >
          <Typography variant="body2" title={item?.file?.name}>
            {item?.file?.name}
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
                color={hasError ? "error" : "secondary"}
              />
            ) : (
              <LinearProgress
                sx={{ flex: 1, mr: 0.1 }}
                value={progressNum}
                variant="determinate"
                color={hasError ? "error" : "primary"}
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
          direction="row"
          alignItems="center"
          justifyContent="center"
          sx={{
            mx: 0.5,
          }}
          className="s3-uploader-item-buttons"
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
          {step === "md5计算" && (
            <Box sx={{ position: "relative" }}>
              <IconButton
                size="small"
                title={`文件校验中...${errMsg ? `(Error-${errMsg})` : ""}`}
                sx={{
                  zIndex: 100,
                  p: 0.25,
                  border: hasError ? `2px solid ${antdColor.error}` : undefined,
                }}
              >
                <IconLockSearch color={antdColor.blue3} />
              </IconButton>
              {!hasError && (
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
          {step === "初始化" && (
            <Box sx={{ position: "relative" }}>
              <IconButton
                size="small"
                onClick={() => console.log(Date.now())}
                title={`上传初始化中,初始化上传任务...${errMsg ? `(Error-${errMsg})` : ""}`}
                sx={{ zIndex: 100, p: 0.25 }}
              >
                <IconPrescription color={antdColor.cyan} />
              </IconButton>
              {!hasError && (
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
            <Box sx={{ position: "relative" }}>
              <IconButton
                size="small"
                title={`上传${pause ? "暂停" : ""}中,点击${pause ? "继续" : "暂停"}${
                  errMsg ? `(Error-${errMsg})` : ""
                }`}
                onClick={switchPause}
                sx={{ zIndex: 100, p: 0.25 }}
              >
                {pause ? <IconPlayerPause color={antdColor.warning} /> : <IconCloudUpload color={antdColor.primary} />}
              </IconButton>{" "}
              {!hasError && !pause && (
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
          <IconButton title="移除" onClick={remove} sx={{ zIndex: 100 }}>
            <IconTrash color={antdColor.error} />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
};
