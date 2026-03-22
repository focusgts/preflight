'use client';

import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  FileJson,
  FileCode,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';

// ── Types ────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  originalName: string;
  size: number;
  format: 'csv' | 'json' | 'xml';
  preview: string[][];
  rowCount: number;
  uploadedAt: string;
  path: string;
}

interface FileUploadProps {
  onFilesUploaded?: (files: UploadedFile[]) => void;
  onFileRemoved?: (fileId: string) => void;
  accept?: string[];
  maxSizeMB?: number;
  multiple?: boolean;
  className?: string;
}

interface UploadingFile {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
  result?: UploadedFile;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const FORMAT_ICONS: Record<string, typeof FileText> = {
  csv: FileText,
  json: FileJson,
  xml: FileCode,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────────────────

export function FileUpload({
  onFilesUploaded,
  onFileRemoved,
  accept = ['.csv', '.json', '.xml'],
  maxSizeMB = 100,
  multiple = true,
  className,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [completedFiles, setCompletedFiles] = useState<UploadedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      // Create uploading state for each file
      const newUploading: UploadingFile[] = files.map((f, i) => ({
        id: `uploading-${Date.now()}-${i}`,
        name: f.name,
        size: f.size,
        progress: 0,
        status: 'uploading' as const,
      }));

      setUploadingFiles((prev) => [...prev, ...newUploading]);

      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }

      try {
        // Simulate progressive upload feedback
        const progressInterval = setInterval(() => {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.status === 'uploading'
                ? { ...f, progress: Math.min(f.progress + 15, 90) }
                : f,
            ),
          );
        }, 200);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const body = await response.json();
          const errorMsg = body.error?.message ?? 'Upload failed';

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.status === 'uploading'
                ? { ...f, status: 'error' as const, error: errorMsg, progress: 100 }
                : f,
            ),
          );
          return;
        }

        const body = await response.json();
        const uploaded: UploadedFile[] = body.data;

        // Mark files as complete
        setUploadingFiles((prev) =>
          prev.map((f) => {
            if (f.status !== 'uploading') return f;
            const match = uploaded.find((u) => u.originalName === f.name);
            if (match) {
              return { ...f, status: 'complete' as const, progress: 100, result: match };
            }
            return { ...f, status: 'error' as const, error: 'File not processed', progress: 100 };
          }),
        );

        setCompletedFiles((prev) => [...prev, ...uploaded]);
        onFilesUploaded?.(uploaded);

        // Clear completed uploads after animation
        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((f) => f.status === 'error'));
        }, 2_000);
      } catch (err) {
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.status === 'uploading'
              ? { ...f, status: 'error' as const, error: 'Network error', progress: 100 }
              : f,
          ),
        );
      }
    },
    [onFilesUploaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounterRef.current = 0;

      const { files } = e.dataTransfer;
      uploadFiles(files);
    },
    [uploadFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files) {
        uploadFiles(files);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [uploadFiles],
  );

  const removeFile = useCallback(
    (fileId: string) => {
      setCompletedFiles((prev) => prev.filter((f) => f.id !== fileId));
      onFileRemoved?.(fileId);
    },
    [onFileRemoved],
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all duration-300',
          isDragOver
            ? 'border-cyan-400 bg-cyan-400/5 shadow-lg shadow-cyan-400/10'
            : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50',
        )}
      >
        <motion.div
          animate={isDragOver ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full transition-colors duration-300',
            isDragOver
              ? 'bg-cyan-400/10 text-cyan-400'
              : 'bg-slate-800 text-slate-400',
          )}
        >
          <Upload className="h-6 w-6" />
        </motion.div>

        <div className="text-center">
          <p className="text-sm font-medium text-slate-200">
            {isDragOver ? 'Drop files here' : 'Drag & drop files, or click to browse'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Supports {accept.map((a) => a.replace('.', '').toUpperCase()).join(', ')} - Max{' '}
            {maxSizeMB}MB per file
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept.join(',')}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          aria-label="Upload files"
        />
      </div>

      {/* Uploading Progress */}
      <AnimatePresence>
        {uploadingFiles.map((file) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
              {file.status === 'uploading' && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />
              )}
              {file.status === 'complete' && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              )}
              {file.status === 'error' && (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm text-slate-200">{file.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{formatFileSize(file.size)}</span>
                </div>
                {file.status === 'uploading' && (
                  <ProgressBar value={file.progress} size="sm" className="mt-1.5" />
                )}
                {file.error && (
                  <p className="mt-1 text-xs text-rose-400">{file.error}</p>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Completed Files */}
      <AnimatePresence>
        {completedFiles.map((file) => {
          const Icon = FORMAT_ICONS[file.format] ?? FileText;

          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="rounded-lg border border-slate-800 bg-slate-900/60"
            >
              {/* File Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                  <Icon className="h-4 w-4 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {file.originalName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(file.size)} - {file.format.toUpperCase()} -{' '}
                    {file.rowCount.toLocaleString()} rows
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.id)}
                  aria-label={`Remove ${file.originalName}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Preview Table */}
              {file.preview.length > 0 && (
                <div className="border-t border-slate-800 px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-slate-400">Preview</p>
                  <div className="overflow-x-auto rounded-md border border-slate-800">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-800/50">
                          {file.preview[0]?.map((header, i) => (
                            <th
                              key={i}
                              className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-slate-300"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {file.preview.slice(1).map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            className="border-b border-slate-800/50 last:border-0"
                          >
                            {row.map((cell, cellIdx) => (
                              <td
                                key={cellIdx}
                                className="whitespace-nowrap px-3 py-1.5 text-slate-400"
                              >
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
