import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, Button, Typography, IconButton, Slider, Paper } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setPageNumber(1);
      setScale(1.0);
      setError(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
    },
    multiple: false,
  });

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const renderViewer = () => {
    if (!file) return null;
    if (file.type === 'application/pdf') {
      return (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => setError('Failed to load PDF.')}
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
          {/* Floating Controls Toolbar */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              bgcolor: 'rgba(255,255,255,0.85)',
              borderRadius: 2,
              boxShadow: 3,
              p: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><ZoomOutIcon /></IconButton>
              <Slider
                value={scale}
                min={0.5}
                max={2.0}
                step={0.1}
                onChange={(_, value) => setScale(value as number)}
                sx={{ width: 100, mx: 1 }}
              />
              <IconButton onClick={() => setScale(s => Math.min(2.0, s + 0.1))}><ZoomInIcon /></IconButton>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                sx={{ mr: 1 }}
                size="small"
              >
                Previous
              </Button>
              <Typography component="span" sx={{ mx: 1, fontSize: 14 }}>
                Page {pageNumber} of {numPages}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                sx={{ ml: 1 }}
                size="small"
              >
                Next
              </Button>
            </Box>
          </Box>
        </Box>
      );
    } else if (SUPPORTED_IMAGE_TYPES.includes(file.type)) {
      return (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          <Paper elevation={2} sx={{ p: 1 }}>
            <img
              src={URL.createObjectURL(file)}
              alt="Uploaded preview"
              style={{ maxWidth: 600 * scale, maxHeight: 800 * scale, transition: 'all 0.2s' }}
            />
          </Paper>
          {/* Floating Zoom Controls Toolbar for Images */}
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 10,
              bgcolor: 'rgba(255,255,255,0.85)',
              borderRadius: 2,
              boxShadow: 3,
              p: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton onClick={() => setScale(s => Math.max(0.5, s - 0.1))}><ZoomOutIcon /></IconButton>
              <Slider
                value={scale}
                min={0.5}
                max={2.0}
                step={0.1}
                onChange={(_, value) => setScale(value as number)}
                sx={{ width: 100, mx: 1 }}
              />
              <IconButton onClick={() => setScale(s => Math.min(2.0, s + 0.1))}><ZoomInIcon /></IconButton>
            </Box>
          </Box>
        </Box>
      );
    } else {
      return <Typography color="error">Unsupported file type.</Typography>;
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Material Takeoff Tool: Blueprint Viewer
      </Typography>
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed #888',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          bgcolor: isDragActive ? '#f0f0f0' : '#fafafa',
          cursor: 'pointer',
        }}
      >
        <input {...getInputProps()} />
        <Typography>
          {isDragActive ? 'Drop the file here...' : 'Drag & drop a PDF or image, or click to select'}
        </Typography>
      </Box>
      {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      {renderViewer()}
    </Box>
  );
};

export default App;
