import { Box } from "@mui/material";
import { IconUpload } from "@tabler/icons-react";

import { antdColor } from "../constants";

export const Trigger = () => (
  <Box
    sx={{
      border: `1px dashed ${antdColor.blue4}`,
      display: "flex",
      p: 0.5,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 2,
      color: antdColor.blue5,
      cursor: "pointer",
    }}
  >
    <IconUpload /> 拖拽或点击上传
  </Box>
);
