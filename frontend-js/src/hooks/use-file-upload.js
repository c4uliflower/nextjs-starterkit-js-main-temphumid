import { useCallback, useRef, useState } from "react";

/**
 * @typedef {Object} FileMetadata
 * @property {string} name
 * @property {number} size
 * @property {string} type
 * @property {string} url
 * @property {string} id
 */

/**
 * @typedef {Object} FileWithPreview
 * @property {File | FileMetadata} file
 * @property {string} id
 * @property {string | undefined} [preview]
 */

/**
 * @typedef {Object} FileUploadOptions
 * @property {number | undefined} [maxFiles]
 * @property {number | undefined} [maxSize]
 * @property {string | undefined} [accept]
 * @property {boolean | undefined} [multiple]
 * @property {FileMetadata[] | undefined} [initialFiles]
 * @property {(files: FileWithPreview[]) => void | undefined} [onFilesChange]
 * @property {(addedFiles: FileWithPreview[]) => void | undefined} [onFilesAdded]
 * @property {(errors: string[]) => void | undefined} [onError]
 */

/**
 * @typedef {Object} FileUploadState
 * @property {FileWithPreview[]} files
 * @property {boolean} isDragging
 * @property {string[]} errors
 */

/**
 * @typedef {Object} FileUploadActions
 * @property {(files: FileList | File[]) => void} addFiles
 * @property {(id: string) => void} removeFile
 * @property {() => void} clearFiles
 * @property {() => void} clearErrors
 * @property {(e: import("react").DragEvent<HTMLElement>) => void} handleDragEnter
 * @property {(e: import("react").DragEvent<HTMLElement>) => void} handleDragLeave
 * @property {(e: import("react").DragEvent<HTMLElement>) => void} handleDragOver
 * @property {(e: import("react").DragEvent<HTMLElement>) => void} handleDrop
 * @property {(e: import("react").ChangeEvent<HTMLInputElement>) => void} handleFileChange
 * @property {() => void} openFileDialog
 * @property {(props?: import("react").InputHTMLAttributes<HTMLInputElement>) => import("react").InputHTMLAttributes<HTMLInputElement> & { ref: import("react").RefObject<HTMLInputElement | null> }} getInputProps
 */

/**
 * @param {FileUploadOptions} [options]
 * @returns {[FileUploadState, FileUploadActions]}
 */
export const useFileUpload = (options = {}) => {
  const {
    maxFiles = Number.POSITIVE_INFINITY,
    maxSize = Number.POSITIVE_INFINITY,
    accept = "*",
    multiple = false,
    initialFiles = [],
    onFilesChange,
    onFilesAdded,
    onError,
  } = options;
  const [state, setState] = useState(
    /** @type {FileUploadState} */ ({
      files: initialFiles.map((file) => ({
        file,
        id: file.id,
        preview: file.url,
      })),
      isDragging: false,
      errors: [],
    }),
  );
  /** @type {import("react").RefObject<HTMLInputElement | null>} */
  const inputRef = useRef(null);
  const validateFile = useCallback(
    /**
     * @param {File | FileMetadata} file
     * @returns {string | null}
     */
    (file) => {
      if (file.size > maxSize) {
        return `File "${file.name}" exceeds the maximum size of ${formatBytes(maxSize)}.`;
      }
      if (accept !== "*") {
        const acceptedTypes = accept.split(",").map((type) => type.trim());
        const fileType = file instanceof File ? file.type || "" : file.type;
        const fileExtension = `.${file.name.split(".").pop()}`;
        const isAccepted = acceptedTypes.some((type) => {
          if (type.startsWith(".")) {
            return fileExtension.toLowerCase() === type.toLowerCase();
          }
          if (type.endsWith("/*")) {
            const baseType = type.split("/")[0];

            return fileType.startsWith(`${baseType}/`);
          }

          return fileType === type;
        });

        if (!isAccepted) {
          return `File "${file.name}" is not an accepted file type.`;
        }
      }

      return null;
    },
    [accept, maxSize],
  );
  const createPreview = useCallback(
    /**
     * @param {File | FileMetadata} file
     * @returns {string | undefined}
     */
    (file) => {
      if (file instanceof File) {
        return URL.createObjectURL(file);
      }

      return file.url;
    },
    [],
  );
  const generateUniqueId = useCallback(
    /**
     * @param {File | FileMetadata} file
     * @returns {string}
     */
    (file) => {
      if (file instanceof File) {
        return `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }

      return file.id;
    },
    [],
  );
  const clearFiles = useCallback(() => {
    setState((prev) => {
      for (const file of prev.files) {
        if (file.preview && file.file instanceof File && file.file.type.startsWith("image/")) {
          URL.revokeObjectURL(file.preview);
        }
      }
      if (inputRef.current) {
        inputRef.current.value = "";
      }

      const newState = {
        ...prev,
        files: [],
        errors: [],
      };

      onFilesChange?.(newState.files);

      return newState;
    });
  }, [onFilesChange]);
  const addFiles = useCallback(
    /**
     * @param {FileList | File[]} newFiles
     */
    (newFiles) => {
      if (!newFiles || newFiles.length === 0) return;
      const newFilesArray = Array.from(newFiles);
      /** @type {string[]} */
      const errors = [];

      setState((prev) => ({ ...prev, errors: [] }));

      if (!multiple) {
        clearFiles();
      }
      if (
        multiple &&
        maxFiles !== Number.POSITIVE_INFINITY &&
        state.files.length + newFilesArray.length > maxFiles
      ) {
        errors.push(`You can only upload a maximum of ${maxFiles} files.`);
        onError?.(errors);
        setState((prev) => ({ ...prev, errors }));

        return;
      }

      /** @type {FileWithPreview[]} */
      const validFiles = [];

      for (const file of newFilesArray) {
        if (multiple) {
          const isDuplicate = state.files.some(
            (existingFile) =>
              existingFile.file.name === file.name && existingFile.file.size === file.size,
          );

          if (isDuplicate) {
            continue;
          }
        }

        const error = validateFile(file);

        if (error) {
          errors.push(error);
        } else {
          validFiles.push({
            file,
            id: generateUniqueId(file),
            preview: createPreview(file),
          });
        }
      }
      if (validFiles.length > 0) {
        onFilesAdded?.(validFiles);
        setState((prev) => {
          const nextFiles = !multiple ? validFiles : [...prev.files, ...validFiles];

          onFilesChange?.(nextFiles);

          return {
            ...prev,
            files: nextFiles,
            errors,
          };
        });
      } else if (errors.length > 0) {
        onError?.(errors);
        setState((prev) => ({
          ...prev,
          errors,
        }));
      }
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [
      state.files,
      maxFiles,
      multiple,
      validateFile,
      createPreview,
      generateUniqueId,
      clearFiles,
      onFilesChange,
      onFilesAdded,
      onError,
    ],
  );
  const removeFile = useCallback(
    /**
     * @param {string} id
     */
    (id) => {
      setState((prev) => {
        const fileToRemove = prev.files.find((file) => file.id === id);

        if (
          fileToRemove &&
          fileToRemove.preview &&
          fileToRemove.file instanceof File &&
          fileToRemove.file.type.startsWith("image/")
        ) {
          URL.revokeObjectURL(fileToRemove.preview);
        }

        const newFiles = prev.files.filter((file) => file.id !== id);

        onFilesChange?.(newFiles);

        return {
          ...prev,
          files: newFiles,
          errors: [],
        };
      });
    },
    [onFilesChange],
  );
  const clearErrors = useCallback(() => {
    setState((prev) => ({
      ...prev,
      errors: [],
    }));
  }, []);
  const handleDragEnter = useCallback(
    /** @param {import("react").DragEvent<HTMLElement>} e */
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setState((prev) => ({ ...prev, isDragging: true }));
    },
    [],
  );
  const handleDragLeave = useCallback(
    /** @param {import("react").DragEvent<HTMLElement>} e */
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.currentTarget.contains(e.relatedTarget)) {
        return;
      }

      setState((prev) => ({ ...prev, isDragging: false }));
    },
    [],
  );
  const handleDragOver = useCallback(
    /** @param {import("react").DragEvent<HTMLElement>} e */
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    [],
  );
  const handleDrop = useCallback(
    /** @param {import("react").DragEvent<HTMLElement>} e */
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setState((prev) => ({ ...prev, isDragging: false }));

      if (inputRef.current?.disabled) {
        return;
      }
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (!multiple) {
          const file = e.dataTransfer.files[0];

          addFiles([file]);
        } else {
          addFiles(e.dataTransfer.files);
        }
      }
    },
    [addFiles, multiple],
  );
  const handleFileChange = useCallback(
    /** @param {import("react").ChangeEvent<HTMLInputElement>} e */
    (e) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles],
  );
  const openFileDialog = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, []);
  const getInputProps = useCallback(
    /**
     * @param {import("react").InputHTMLAttributes<HTMLInputElement>} [props]
     * @returns {import("react").InputHTMLAttributes<HTMLInputElement> & { ref: import("react").RefObject<HTMLInputElement | null> }}
     */
    (props = {}) => {
      return {
        ...props,
        type: "file",
        onChange: handleFileChange,
        accept: props.accept || accept,
        multiple: props.multiple !== undefined ? props.multiple : multiple,
        ref: inputRef,
      };
    },
    [accept, multiple, handleFileChange],
  );

  return [
    state,
    {
      addFiles,
      removeFile,
      clearFiles,
      clearErrors,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      handleFileChange,
      openFileDialog,
      getInputProps,
    },
  ];
};

/**
 * @param {number} bytes
 * @param {number} [decimals]
 * @returns {string}
 */
export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Number.parseFloat((bytes / k ** i).toFixed(dm)) + " " + sizes[i];
};
