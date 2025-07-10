import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, Button, IconButton, Typography, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useDropzone } from 'react-dropzone';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set workerSrc for pdfjs
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const samplePDF =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

function App() {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState<{x: number, y: number}[]>([]);
  const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
  const [realLength, setRealLength] = useState('');
  const [scale, setScale] = useState<number | null>(null); // pixels per unit
  const [calibrationError, setCalibrationError] = useState('');
  const [open, setOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(samplePDF);

  // Measurement overlay state
  const [measuring, setMeasuring] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState<{x: number, y: number}[]>([]);
  const [measurements, setMeasurements] = useState<{points: {x: number, y: number}[], length: number}[]>([]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const handlePrevPage = () => setPageNumber((prev) => Math.max((prev ?? 1) - 1, 1));
  const handleNextPage = () =>
    setPageNumber((prev) => (numPages ? Math.min((prev ?? 1) + 1, numPages) : (prev ?? 1)));
  const handleZoomIn = () => setScale((prev) => Math.min((prev ?? 1.0) + 0.2, 3));
  const handleZoomOut = () => setScale((prev) => Math.max((prev ?? 1.0) - 0.2, 0.5));

  // Dropzone logic
  const onDrop = React.useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles[0]) {
      setPdfFile(acceptedFiles[0]);
      setPdfUrl(URL.createObjectURL(acceptedFiles[0]));
      setOpen(false);
    }
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [] },
    multiple: false,
  });

  // File picker fallback
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setPdfUrl(URL.createObjectURL(file));
      setOpen(false);
    }
  };

  // Helper to get click coordinates relative to the PDF container
  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!calibrationMode) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / scaleFactor;
    const y = (e.clientY - rect.top) / scaleFactor;
    setCalibrationPoints((prev) => [...prev, { x, y }]);
  };

  // Handle click for measurement overlay
  const handleMeasurementClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!measuring || !scale) return;
    const rect = (e.target as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / scaleFactor;
    const y = (e.clientY - rect.top) / scaleFactor;
    setMeasurementPoints((prev) => [...prev, { x, y }]);
  };

  // Handle double-click to finish polyline measurement
  const handleMeasurementDoubleClick = () => {
    if (!measuring || !scale || measurementPoints.length < 2) return;
    // Calculate total real-world length
    let total = 0;
    for (let i = 1; i < measurementPoints.length; i++) {
      const p1 = measurementPoints[i - 1];
      const p2 = measurementPoints[i];
      const pixelDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      total += pixelDist / scale;
    }
    setMeasurements((prev) => [...prev, { points: [...measurementPoints], length: total }]);
    setMeasurementPoints([]);
    setMeasuring(false);
  };

  // Calculate scale factor for overlay (syncs with PDF zoom)
  const scaleFactor = scale || 1.0;

  // When two points are selected, open dialog for real-world length
  useEffect(() => {
    if (calibrationMode && calibrationPoints.length === 2) {
      setCalibrationDialogOpen(true);
    }
  }, [calibrationPoints, calibrationMode]);

  // Handle calibration dialog submit
  const handleCalibrationSubmit = () => {
    const len = parseFloat(realLength);
    if (isNaN(len) || len <= 0) {
      setCalibrationError('Please enter a valid positive number.');
      return;
    }
    // Calculate pixel distance
    const [p1, p2] = calibrationPoints;
    const pixelDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    setScale(pixelDist / len); // pixels per unit
    setCalibrationDialogOpen(false);
    setCalibrationMode(false);
    setCalibrationPoints([]);
    setRealLength('');
    setCalibrationError('');
  };

  // Render calibration overlay (line between two points)
  const renderCalibrationOverlay = () => {
    if (calibrationPoints.length === 0) return null;
    const points = calibrationPoints.map(p => `${p.x * scaleFactor},${p.y * scaleFactor}`).join(' ');
    return (
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
      >
        {calibrationPoints.length === 2 ? (
          <line
            x1={calibrationPoints[0].x * scaleFactor}
            y1={calibrationPoints[0].y * scaleFactor}
            x2={calibrationPoints[1].x * scaleFactor}
            y2={calibrationPoints[1].y * scaleFactor}
            stroke="#1976d2"
            strokeWidth={2}
          />
        ) : null}
        {calibrationPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x * scaleFactor}
            cy={p.y * scaleFactor}
            r={6}
            fill="#1976d2"
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
      </svg>
    );
  };

  // Render measurement overlay (lines, points, lengths)
  const renderMeasurementOverlay = () => {
    if (!scale) return null;
    return (
      <svg
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', width: '100%', height: '100%' }}
      >
        {/* Existing measurements */}
        {measurements.map((m, idx) => (
          <g key={idx}>
            {m.points.map((p, i) =>
              i > 0 ? (
                <line
                  key={i}
                  x1={m.points[i - 1].x * scaleFactor}
                  y1={m.points[i - 1].y * scaleFactor}
                  x2={p.x * scaleFactor}
                  y2={p.y * scaleFactor}
                  stroke="#43a047"
                  strokeWidth={2}
                />
              ) : null
            )}
            {/* Show total length at last point */}
            {m.points.length > 1 && (
              <text
                x={m.points[m.points.length - 1].x * scaleFactor + 8}
                y={m.points[m.points.length - 1].y * scaleFactor - 8}
                fill="#43a047"
                fontSize={16}
                fontWeight="bold"
                stroke="#fff"
                strokeWidth={0.5}
              >
                {m.length.toFixed(2)} units
              </text>
            )}
          </g>
        ))}
        {/* Current measurement in progress */}
        {measurementPoints.map((p, i) =>
          i > 0 ? (
            <line
              key={i}
              x1={measurementPoints[i - 1].x * scaleFactor}
              y1={measurementPoints[i - 1].y * scaleFactor}
              x2={p.x * scaleFactor}
              y2={p.y * scaleFactor}
              stroke="#1976d2"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          ) : null
        )}
        {measurementPoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x * scaleFactor}
            cy={p.y * scaleFactor}
            r={6}
            fill="#1976d2"
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
        {/* Show current length at last point */}
        {measurementPoints.length > 1 && (
          <text
            x={measurementPoints[measurementPoints.length - 1].x * scaleFactor + 8}
            y={measurementPoints[measurementPoints.length - 1].y * scaleFactor - 8}
            fill="#1976d2"
            fontSize={16}
            fontWeight="bold"
            stroke="#fff"
            strokeWidth={0.5}
          >
            {(() => {
              let total = 0;
              for (let i = 1; i < measurementPoints.length; i++) {
                const p1 = measurementPoints[i - 1];
                const p2 = measurementPoints[i];
                const pixelDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                total += pixelDist / scale;
              }
              return total.toFixed(2) + ' units';
            })()}
          </text>
        )}
      </svg>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f5f5', p: 4 }}>
      <Paper elevation={3} sx={{ maxWidth: 800, mx: 'auto', p: 2, position: 'relative' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" align="center">
            PDF Blueprint Viewer
          </Typography>
          <Button
            variant="contained"
            startIcon={<UploadFileIcon />}
            onClick={() => setOpen(true)}
            sx={{ ml: 2 }}
          >
            Open PDF
          </Button>
          <Button
            variant={calibrationMode ? 'contained' : 'outlined'}
            color={calibrationMode ? 'secondary' : 'primary'}
            onClick={() => {
              setCalibrationMode((prev) => !prev);
              setCalibrationPoints([]);
              setCalibrationError('');
            }}
            sx={{ ml: 2 }}
          >
            {calibrationMode ? 'Cancel Calibration' : 'Calibrate Scale'}
          </Button>
          <Button
            variant={measuring ? 'contained' : 'outlined'}
            color={measuring ? 'secondary' : 'primary'}
            onClick={() => {
              setMeasuring((prev) => !prev);
              setMeasurementPoints([]);
            }}
            sx={{ ml: 2 }}
            disabled={!scale}
          >
            {measuring ? 'Cancel Measurement' : 'Measure'}
          </Button>
        </Box>
        <Box display="flex" justifyContent="center" alignItems="center" mb={2}>
          <IconButton onClick={handlePrevPage} disabled={pageNumber <= 1}>
            <NavigateBeforeIcon />
          </IconButton>
          <Typography sx={{ mx: 2 }}>
            Page {pageNumber} {numPages ? `/ ${numPages}` : ''}
          </Typography>
          <IconButton
            onClick={handleNextPage}
            disabled={numPages ? pageNumber >= numPages : true}
          >
            <NavigateNextIcon />
          </IconButton>
          <IconButton onClick={handleZoomOut} sx={{ ml: 4 }}>
            <ZoomOutIcon />
          </IconButton>
          <IconButton onClick={handleZoomIn}>
            <ZoomInIcon />
          </IconButton>
        </Box>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          position="relative"
          onClick={calibrationMode ? handlePdfClick : measuring ? handleMeasurementClick : undefined}
          onDoubleClick={measuring ? handleMeasurementDoubleClick : undefined}
          style={{ cursor: calibrationMode || measuring ? 'crosshair' : 'default' }}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<Typography>Loading PDF...</Typography>}
            error={<Typography color="error">Failed to load PDF.</Typography>}
          >
            <Page pageNumber={pageNumber} scale={scaleFactor} />
          </Document>
          {calibrationMode && renderCalibrationOverlay()}
          {renderMeasurementOverlay()}
        </Box>
      </Paper>
      {/* Calibration dialog */}
      <Dialog open={calibrationDialogOpen} onClose={() => setCalibrationDialogOpen(false)}>
        <DialogTitle>Enter Real-World Length</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Length (e.g., feet, meters)"
            type="number"
            fullWidth
            value={realLength}
            onChange={e => setRealLength(e.target.value)}
            error={!!calibrationError}
            helperText={calibrationError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalibrationDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCalibrationSubmit} variant="contained">Set Scale</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Upload or Drag & Drop PDF</DialogTitle>
        <DialogContent>
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed #1976d2',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              bgcolor: isDragActive ? '#e3f2fd' : '#fafafa',
              cursor: 'pointer',
              mb: 2,
            }}
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <Typography>Drop the PDF here ...</Typography>
            ) : (
              <Typography>
                Drag & drop a PDF file here, or click to select a file
              </Typography>
            )}
          </Box>
          <Typography align="center" variant="body2" color="textSecondary">
            OR
          </Typography>
          <Box display="flex" justifyContent="center" mt={2}>
            <Button variant="outlined" component="label">
              Choose PDF
              <input
                type="file"
                accept="application/pdf"
                hidden
                onChange={handleFileChange}
              />
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
