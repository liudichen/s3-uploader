"use client";

import { Box, type SxProps } from "@mui/material";
import { IconUpload } from "@tabler/icons-react";

import { antdColor } from "../constants";

const sx: SxProps = {
  border: `1px dashed ${antdColor.blue4}`,
  display: "flex",
  p: 0.5,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 2,
  color: antdColor.blue5,
  cursor: "pointer",
};

export const Trigger = () => (
  <Box sx={sx}>
    <IconUpload /> 拖拽或点击上传
  </Box>
);
