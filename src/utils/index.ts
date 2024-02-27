import { ComponentType, type RefObject } from "react";
import {
  IconExcelColorful,
  IconFileColorful,
  IconImageColorful,
  IconPdfColorful,
  IconPptColorful,
  type IconProps,
  IconVideoColorful,
  IconWordColorful,
  IconZipColorful,
} from "@iimm/icons";
import SparkMD5 from "spark-md5";

import type { XhrFailResponse } from "../interface";

export const getFileIcon = (fileName: string = "", mimeType: string = ""): ComponentType<IconProps> => {
  if (!!mimeType) {
    if (mimeType.startsWith("image/")) {
      return IconImageColorful;
    } else if (mimeType.startsWith("video/")) {
      return IconVideoColorful;
    } else {
      const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
      if (ext) {
        if (ext === "pdf") {
          return IconPdfColorful;
        } else if (["doc", "docx", "wps", "wpt"].includes(ext)) {
          return IconWordColorful;
        } else if (["xls", "xlsx", "et", "ett", "csv"].includes(ext)) {
          return IconExcelColorful;
        } else if (["ppt", "pptx"].includes(ext)) {
          return IconPptColorful;
        } else if (["zip", "rar", "7z", "tar"].includes(ext)) {
          return IconZipColorful;
        }
      }
    }
  }

  return IconFileColorful;
};

//4M
const defaultChunkSize = 1024 * 1024 * 4;

interface FileMd5Options {
  /**每次读取的文件切片大小
   * @default 4194304='4M'
   */
  chunkSize?: number;
  abortRef?: RefObject<boolean>;
  onprogress?: (p: number) => void;
}

export const getFileMd5 = async (file: File, options?: FileMd5Options) => {
  const { chunkSize = defaultChunkSize, abortRef, onprogress } = options || {};

  const md5: string | false | 0 = await new Promise((resolve) => {
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
        onprogress(+((100 * i) / chunks).toFixed(2));
      }

      if (i < chunks) {
        loadNext();
      } else {
        const md5 = spark.end();
        resolve(md5);
        reader?.abort();
      }
    };

    reader.onerror = () => {
      resolve(false);
    };

    loadNext();
  });

  return md5;
};

interface XhrRequestOptions {
  contentType?: string;
  timeout?: number;
  responseType?: XMLHttpRequestResponseType;
  onprogress?: XMLHttpRequestEventTarget["onprogress"];
  onerror?: XMLHttpRequestEventTarget["onerror"];
  url?: string;
}

export function s3Request<SuccessResponse>(
  action: "preUpload" | "uploadPart" | "completeUpload" | "abortUpload",
  Url: string,
  data: XMLHttpRequestBodyInit | null | undefined,
  options?: XhrRequestOptions
) {
  const { timeout, contentType, responseType = "json", onprogress, onerror } = options || {};

  const method = action === "preUpload" ? "POST" : action === "abortUpload" ? "DELETE" : "PUT";

  return new Promise<SuccessResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (timeout) xhr.timeout = timeout;
    xhr.onreadystatechange = function () {
      switch (xhr.readyState) {
        case 4:
          if (xhr.status > 199 && xhr.status < 210) {
            resolve(xhr.response as SuccessResponse);
          } else {
            reject(xhr.response as XhrFailResponse);
          }
          break;
        default:
          break;
      }
    };
    xhr.open(method, Url, true);
    xhr.onerror =
      onerror ||
      ((err) => {
        reject(err);
      });
    if (onprogress) xhr.upload.onprogress = onprogress;
    if (contentType) {
      xhr.setRequestHeader("Content-Type", contentType);
    } else if (action !== "uploadPart") {
      xhr.setRequestHeader("Content-Type", "application/json");
    }
    if (responseType) xhr.responseType = responseType;
    xhr.send(data);
  });
}

export const isSameFile = (a: File, b: File) =>
  a === b || (a.size === b.size && a.name === b.name && a.lastModified === b.lastModified);
