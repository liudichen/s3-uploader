import axios from "axios";
import SparkMD5 from "spark-md5";
import {
  IconExcelColorful,
  IconFileColorful,
  IconImageColorful,
  IconPdfColorful,
  IconPptColorful,
  IconVideoColorful,
  IconWordColorful,
  IconZipColorful,
} from "@iimm/icons";

import type {
  S3PartUploadRequestFn,
  S3CompleteUploadRequestFn,
  S3PreUploadRequestFn,
  S3PreUploadResponse,
  S3CompleteUploadResponse,
  S3AbortUploadRequestFn,
  Md5GetterOptions,
  FileIconRender,
  IsSameFileFn,
} from "../interface";

export const antdColor = {
  error: "#ff4d4f",
  success: "#52c41a",
  cyan: "#13c2c2",
  gray3: "#f5f5f5",
  gray4: "#f0f0f0",
  gray5: "#d9d9d9",
  gray6: "#bfbfbf",
  gray7: "#8c8c8c",
  gray8: "#595959",
  gray9: "#434343",
  gray10: "#262626",
  lime: "#a0d911",
  purple: "#722ed1",
  warning: "#faad14",
  blue3: "#91caff",
  blue4: "#69b1ff",
  blue5: "#40a9ff",
  primary: "#1677ff",
};

export const s3PreUploadRequestFn: S3PreUploadRequestFn = (url, data, options) => {
  const { timeout, baseURL, urlConvert, onError, method, ...rest } = options || {};
  const instance = axios.create({ baseURL, timeout });

  return new Promise((resolve, reject) => {
    instance({
      method: method || "POST",
      data,
      url: urlConvert?.(url, "request", "preUpload") || url,
      ...rest,
    })
      .then((response) => {
        const { status, data } = response;
        if (status > 199 && status < 210) {
          const result = { ...(data || {}) } as S3PreUploadResponse;
          if (result.url && urlConvert) {
            result.url = urlConvert?.(result.url, "response", "preUpload") || result.url;
          }
          resolve(result);
        } else {
          reject(data);
        }
      })
      .catch((err) => {
        console.log("S3PreUploadError", err);
        onError?.(err);
        reject(err);
      });
  });
};

export const s3PartUploadRequestFn: S3PartUploadRequestFn = (url, data, options) => {
  const { timeout, baseURL, urlConvert, onError, method, ...rest } = options || {};
  const instance = axios.create({ baseURL, timeout });

  if (rest.headers) {
    rest.headers["Content-Type"] = "";
  } else {
    rest.headers = { "Content-Type": "" };
  }

  return new Promise((resolve, reject) => {
    instance({
      method: method || "PUT",
      data,
      url: urlConvert?.(url, "request", "partUpload") || url,
      ...rest,
    })
      .then((response) => {
        const { status, data } = response;
        if (status > 199 && status < 210) {
          resolve(true);
        } else {
          reject(data);
        }
      })
      .catch((err) => {
        console.log("S3PartUploadError", err);
        onError?.(err);
        reject(err);
      });
  });
};

export const s3CompleteUploadRequestFn: S3CompleteUploadRequestFn = (url, data, options) => {
  const { timeout, baseURL, urlConvert, onError, method, ...rest } = options || {};
  const instance = axios.create({ baseURL, timeout });

  return new Promise((resolve, reject) => {
    instance({
      method: method || "PUT",
      data,
      url: urlConvert?.(url, "request", "completeUpload") || url,
      ...rest,
    })
      .then((response) => {
        const { status, data } = response;
        if (status > 199 && status < 210) {
          const result = { ...(data || {}) } as S3CompleteUploadResponse;
          if (result.url && urlConvert) {
            result.url = urlConvert?.(result.url, "response", "completeUpload");
          }
          resolve(result);
        } else {
          reject(data);
        }
      })
      .catch((err) => {
        console.log("S3PreUploadError", err);
        onError?.(err);
        reject(err);
      });
  });
};

export const s3AbortUploadRequestFn: S3AbortUploadRequestFn = (url, data, options) => {
  const { timeout, baseURL, urlConvert, onError, method, ...rest } = options || {};
  const instance = axios.create({ baseURL, timeout });

  return new Promise((resolve, reject) => {
    instance({
      method: method || "DELETE",
      data,
      url: urlConvert?.(url, "request", "abortUpload") || url,
      ...rest,
    })
      .then((response) => {
        const { status, data } = response;
        if (status > 199 && status < 210) {
          resolve(true);
        } else {
          reject(data);
        }
      })
      .catch((err) => {
        console.log("S3PreUploadError", err);
        onError?.(err);
        reject(err);
      });
  });
};

//4M
const defaultChunkSize = 1024 * 1024 * 4;

export const md5GetterFn = async (file: File, options?: Md5GetterOptions) => {
  const { chunkSize = defaultChunkSize, abortRef, onprogress, onerror } = options || {};

  const res = await new Promise<string | 0 | false>((resolve) => {
    const chunks = Math.ceil(file.size / chunkSize);

    const spark = new SparkMD5.ArrayBuffer();
    const reader = new FileReader();

    let i = 0;

    const loadNext = () => {
      if (abortRef?.current) {
        reader?.abort();
        resolve(0);
        return;
      }
      const start = i * chunkSize;
      const end = start + chunkSize >= file.size ? file.size : start + chunkSize;

      reader.readAsArrayBuffer(file.slice(start, end));
    };

    reader.onload = function (e) {
      spark.append(e.target!.result as ArrayBuffer);
      i++;

      if (onprogress) {
        onprogress!(+((100 * i) / chunks).toFixed(2));
      }

      if (i < chunks) {
        loadNext();
      } else {
        const md5 = spark.end();
        resolve(md5);
        reader?.abort();
      }
    };

    reader.onerror = (e) => {
      if (onerror) {
        onerror!(e);
      }
      resolve(false);
    };

    loadNext();
  });

  return res;
};

export const fileIconRenderFn: FileIconRender = (file) => {
  const { name: fileName, type: fileType = "" } = file;

  let Icon = IconFileColorful;

  if (fileType && (fileType.startsWith("image/") || fileType.startsWith("video/"))) {
    Icon = fileType.startsWith("image/") ? IconImageColorful : IconVideoColorful;
  } else {
    const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
    if (ext) {
      if (ext === "pdf") {
        Icon = IconPdfColorful;
      } else if (["doc", "docx", "wps", "wpt"].includes(ext)) {
        Icon = IconWordColorful;
      } else if (["xls", "xlsx", "et", "ett", "csv"].includes(ext)) {
        Icon = IconExcelColorful;
      } else if (["ppt", "pptx"].includes(ext)) {
        Icon = IconPptColorful;
      } else if (["zip", "rar", "7z", "tar"].includes(ext)) {
        Icon = IconZipColorful;
      }
    }
  }

  return <Icon size={24} />;
};

export const isSameFileFn: IsSameFileFn = (a, b) =>
  !!a && (a === b || (a.size === b?.size && a.name === b.name && a.lastModified === b.lastModified));
