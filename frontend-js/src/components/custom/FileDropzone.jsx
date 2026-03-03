import { useFileUpload, formatBytes } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";
import { FileIcon, ImageIcon, UploadIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  maxFiles = 5,
  maxSize = 5 * 1024 * 1024,
  accept = "image/*,application/pdf,.doc,.docx",
  multiple = true,
  disabled = false,
  className,
  onFilesChange,
}) {
  const [
    { files, isDragging, errors },
    {
      removeFile,
      clearFiles,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      getInputProps,
    },
  ] = useFileUpload({
    maxFiles,
    maxSize,
    accept,
    multiple,
    onFilesChange,
  });

  const isImage = (file) => {
    const type = file instanceof File ? file.type : file.type;

    return type.startsWith("image/");
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Dropzone */}
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "pointer-events-none opacity-50",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input {...getInputProps()} className="sr-only" disabled={disabled} />

        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "flex size-20 items-center justify-center rounded-full",
              isDragging ? "bg-primary/10" : "bg-muted",
            )}
          >
            <ImageIcon
              className={cn("size-10", isDragging ? "text-primary" : "text-muted-foreground")}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Drop your files here</h3>
            <p className="text-sm text-muted-foreground">
              {accept === "*" ? "Any file type" : accept.replace(/,/g, ", ")} (max.{" "}
              {formatBytes(maxSize)})
            </p>
          </div>

          <Button onClick={openFileDialog} variant="outline" className="gap-2" disabled={disabled}>
            <UploadIcon className="size-4" />
            Select files
          </Button>
        </div>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {errors.map((error, index) => (
            <li key={index} className="text-sm text-destructive">
              {error}
            </li>
          ))}
        </ul>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Uploaded files ({files.length})</h4>
            <Button
              onClick={clearFiles}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              Remove all
            </Button>
          </div>

          <div className="grid gap-3">
            {files.map((fileItem) => (
              <div
                key={fileItem.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                {/* File Preview */}
                <div className="shrink-0">
                  {isImage(fileItem.file) && fileItem.preview ? (
                    <img
                      src={fileItem.preview}
                      alt={fileItem.file.name}
                      className="size-12 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                      <FileIcon className="size-6 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{fileItem.file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(fileItem.file.size)}</p>
                </div>

                {/* Remove Button */}
                <Button
                  onClick={() => removeFile(fileItem.id)}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
