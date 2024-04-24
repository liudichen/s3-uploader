"use client";

import { useCreation, useSafeState } from "ahooks";
import { Box } from "@mui/material";
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

import type { FileIconRenderProps } from "../interface";

export const InnerFileIconRender = ({ item, preview, PreviewRender }: FileIconRenderProps) => {
  if (!item) return null;
  const { name: fileName, type: fileType = "", url } = item || {};
  const canPreview = !!preview && !!PreviewRender && !!url;

  const [open, setOpen] = useSafeState(false);

  const onClick = useCreation(() => (canPreview ? () => setOpen(true) : undefined), [canPreview]);

  let Icon = IconFileColorful;
  let isImage = false;

  if (fileType && (fileType.startsWith("image/") || fileType.startsWith("video/"))) {
    if (fileType.startsWith("image/")) {
      Icon = IconImageColorful;
      isImage = true;
    } else {
      Icon = IconVideoColorful;
    }
  } else {
    const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
    if (ext) {
      if (["pdf", "odf"].includes(ext)) {
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
  const icon =
    isImage && !!url ? (
      <Box width={30} height={30} display="flex">
        <img src={url} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
      </Box>
    ) : (
      <Icon size={26} />
    );

  return (
    <Box
      onClick={onClick}
      title={canPreview ? "点击进行文件预览" : undefined}
      sx={canPreview ? { cursor: "pointer" } : undefined}
    >
      {icon}
      {canPreview && <PreviewRender item={item} open={open} onChange={setOpen} />}
    </Box>
  );
};
