import React, { useState, useEffect } from 'react';
import { Page, Modality, DetectionResult, SystemStats, HistoryItem } from '../types';
import { detectContent, submitFeedback, getSystemStats, getHistory, clearHistory } from '../services/detectionService';

export function useForensica() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedModality, setSelectedModality] = useState<Modality | null>(null);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchHistory();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await getSystemStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await getHistory();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const navigate = (page: Page, modality: Modality | null = null) => {
    setCurrentPage(page);
    if (modality) setSelectedModality(modality);
    setResult(null);
    setFile(null);
    setPreviewUrl(null);
    setTextInput('');
    setFeedbackSubmitted(false);
    fetchStats();
    fetchHistory();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    if (selectedFile) {
      const sizeInMB = selectedFile.size / (1024 * 1024);
      let limit = 0;
      if (selectedModality === 'photo') limit = 50;
      if (selectedModality === 'video') limit = 500;
      if (selectedModality === 'audio') limit = 50;
      
      if (sizeInMB > limit) {
        alert(`File exceeds ${limit}MB limit.`);
        e.target.value = ''; // Reset input
        return;
      }
    }
    
    setFile(selectedFile);
    if (selectedFile && selectedModality === 'photo') {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedModality) return;
    const content = selectedModality === 'text' ? textInput : file;
    if (!content) return;

    // Validation
    if (selectedModality === 'text') {
      const wordCount = textInput.trim().split(/\s+/).length;
      if (wordCount > 1000) {
        alert('Text exceeds 1000 words limit.');
        return;
      }
    } else if (file) {
      const sizeInMB = file.size / (1024 * 1024);
      if (selectedModality === 'photo' && sizeInMB > 50) {
        alert('Photo exceeds 50MB limit.');
        return;
      }
      if (selectedModality === 'video' && sizeInMB > 500) {
        alert('Video exceeds 500MB limit.');
        return;
      }
      if (selectedModality === 'audio' && sizeInMB > 50) {
        alert('Audio exceeds 50MB limit.');
        return;
      }
    }

    setIsAnalyzing(true);
    setFeedbackSubmitted(false);
    
    try {
      const data = await detectContent(selectedModality, content);
      
      // Simulate processing time for the futuristic UI
      setTimeout(() => {
        setResult(data);
        setIsAnalyzing(false);
        fetchStats();
        fetchHistory();
      }, 5000);
    } catch (error) {
      console.error('Detection failed:', error);
      setIsAnalyzing(false);
    }
  };

  const handleFeedback = async (rating: number, isCorrect: boolean) => {
    if (!result?.id) return;
    try {
      await submitFeedback(result.id, rating, isCorrect);
      setFeedbackSubmitted(true);
      fetchStats();
      fetchHistory();
    } catch (error) {
      console.error('Feedback failed:', error);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory();
      fetchStats();
      fetchHistory();
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const resetAnalysis = () => {
    setResult(null);
    setFile(null);
    setTextInput('');
    setPreviewUrl(null);
    setFeedbackSubmitted(false);
  };

  return {
    currentPage,
    selectedModality,
    result,
    isAnalyzing,
    file,
    previewUrl,
    textInput,
    stats,
    history,
    feedbackSubmitted,
    navigate,
    handleFileChange,
    handleAnalyze,
    handleFeedback,
    handleClearHistory,
    resetAnalysis,
    setFile,
    setPreviewUrl,
    setTextInput,
  };
}
