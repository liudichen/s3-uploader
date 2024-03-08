import { type RefObject, type PropsWithChildren, forwardRef, useImperativeHandle } from "react";
import { useDropzone, type DropzoneOptions } from "react-dropzone";

interface UploadZoneProps extends PropsWithChildren<DropzoneOptions> {
  className?: string;
}

interface UploadZoneHandlerRef {
  inputRef: RefObject<HTMLInputElement>;
  rootRef: RefObject<HTMLElement>;
  open: () => void;
}

export const UploadZone = forwardRef<UploadZoneHandlerRef, UploadZoneProps>((props, ref) => {
  const { children, className, ...restProps } = props;
  const { getInputProps, getRootProps, inputRef, open, rootRef } = useDropzone({ useFsAccessApi: false, ...restProps });

  useImperativeHandle(ref, () => ({ inputRef, rootRef, open }));

  return (
    <div {...getRootProps()} className={className}>
      <input {...getInputProps()} />
      {children}
    </div>
  );
});
