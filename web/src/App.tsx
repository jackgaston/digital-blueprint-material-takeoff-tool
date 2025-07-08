import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Document, Page, pdfjs } from 'react-pdf';
import { Box, Button, Typography, IconButton, Slider, Paper, ToggleButton, ToggleButtonGroup, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
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
  // Measurement tool state
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Calibration and units
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const [calibration, setCalibration] = useState<{ px: number; real: number } | null>(null);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [calibrateValue, setCalibrateValue] = useState('');

  useEffect(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect());
    }
  }, [file, scale, pageNumber]);

  // Open calibration dialog after a measurement
  useEffect(() => {
    if (measureStart && measureEnd && !calibration) {
      setCalibrateOpen(true);
    }
  }, [measureStart, measureEnd, calibration]);

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

  // Helper to get mouse position relative to the viewer container
  const getRelativePos = (e: React.MouseEvent) => {
    if (!containerRect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - containerRect.left) / scale,
      y: (e.clientY - containerRect.top) / scale,
    };
  };

  // Handle click for measurement
  const handleViewerClick = (e: React.MouseEvent) => {
    if (!containerRect) return;
    const pos = getRelativePos(e);
    if (!measureStart) {
      setMeasureStart(pos);
      setMeasureEnd(null);
    } else if (!measureEnd) {
      setMeasureEnd(pos);
    } else {
      setMeasureStart(pos);
      setMeasureEnd(null);
    }
  };

  // Calculate pixel distance
  const getDistance = () => {
    if (!measureStart || !measureEnd) return 0;
    const dx = measureEnd.x - measureStart.x;
    const dy = measureEnd.y - measureStart.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Calculate real-world distance
  const getRealDistance = () => {
    if (!measureStart || !measureEnd) return 0;
    const pxDist = getDistance();
    if (!calibration) return 0;
    return (pxDist / calibration.px) * calibration.real;
  };

  // Handle calibration submit
  const handleCalibrate = () => {
    const pxDist = getDistance();
    const real = parseFloat(calibrateValue);
    if (pxDist > 0 && real > 0) {
      setCalibration({ px: pxDist, real });
      setCalibrateOpen(false);
      setCalibrateValue('');
    }
  };

  // Handle unit toggle
  const handleUnitChange = (_: any, newUnits: 'imperial' | 'metric' | null) => {
    if (newUnits) setUnits(newUnits);
  };

  // Overlay SVG for measurement
  const renderMeasurementOverlay = () => {
    if (!containerRect) return null;
    return (
      <svg
        width={containerRect.width}
        height={containerRect.height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        {measureStart && measureEnd && (
          <>
            <line
              x1={measureStart.x * scale}
              y1={measureStart.y * scale}
              x2={measureEnd.x * scale}
              y2={measureEnd.y * scale}
              stroke="red"
              strokeWidth={2}
            />
            <circle
              cx={measureStart.x * scale}
              cy={measureStart.y * scale}
              r={4}
              fill="blue"
            />
            <circle
              cx={measureEnd.x * scale}
              cy={measureEnd.y * scale}
              r={4}
              fill="blue"
            />
            <text
              x={(measureStart.x * scale + measureEnd.x * scale) / 2}
              y={(measureStart.y * scale + measureEnd.y * scale) / 2 - 10}
              fill="black"
              fontSize={16}
              textAnchor="middle"
              stroke="white"
              strokeWidth={0.5}
            >
              {calibration
                ? `${getRealDistance().toFixed(2)} ${units === 'imperial' ? 'ft' : 'm'}`
                : `${getDistance().toFixed(1)} px`}
            </text>
          </>
        )}
      </svg>
    );
  };

  const renderViewer = () => {
    if (!file) return null;
    // Wrap viewer in a ref container for overlay
    return (
      <Box
        sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
        ref={containerRef}
        onClick={handleViewerClick}
        style={{ cursor: 'crosshair' }}
      >
        {/* Existing PDF or image rendering logic */}
        {file.type === 'application/pdf' ? (
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => setError('Failed to load PDF.')}
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
        ) : (
          <Paper elevation={2} sx={{ p: 1 }}>
            <img
              src={URL.createObjectURL(file)}
              alt="Uploaded preview"
              style={{ maxWidth: 600 * scale, maxHeight: 800 * scale, transition: 'all 0.2s' }}
            />
          </Paper>
        )}
        {/* Overlay for measurement */}
        {renderMeasurementOverlay()}
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
  };

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Material Takeoff Tool: Blueprint Viewer
      </Typography>
      {/* Unit toggle and calibration status */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <ToggleButtonGroup
          value={units}
          exclusive
          onChange={handleUnitChange}
          size="small"
        >
          <ToggleButton value="imperial">Imperial (ft)</ToggleButton>
          <ToggleButton value="metric">Metric (m)</ToggleButton>
        </ToggleButtonGroup>
        {calibration && (
          <Typography variant="body2" color="success.main">
            Calibrated: {calibration.real} {units === 'imperial' ? 'ft' : 'm'} = {calibration.px.toFixed(1)} px
          </Typography>
        )}
        {!calibration && (
          <Button variant="outlined" size="small" onClick={() => setCalibrateOpen(true)}>
            Calibrate
          </Button>
        )}
        {(measureStart || measureEnd) && (
          <Button variant="outlined" size="small" color="secondary" onClick={() => { setMeasureStart(null); setMeasureEnd(null); }}>
            Clear Measurement
          </Button>
        )}
      </Box>
      {/* Calibration dialog */}
      <Dialog open={calibrateOpen} onClose={() => setCalibrateOpen(false)}>
        <DialogTitle>Calibrate Measurement</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Enter the real-world distance for the measured line:
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label={`Distance (${units === 'imperial' ? 'ft' : 'm'})`}
            type="number"
            fullWidth
            value={calibrateValue}
            onChange={e => setCalibrateValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalibrateOpen(false)}>Cancel</Button>
          <Button onClick={handleCalibrate} disabled={!calibrateValue}>Set Calibration</Button>
        </DialogActions>
      </Dialog>
      {/* File drop and viewer */}
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
