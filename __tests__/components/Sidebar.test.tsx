// FIX: Add a triple-slash directive to explicitly include jest-dom type definitions.
/// <reference types="@testing-library/jest-dom" />

// FIX: Add jest imports
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from '../../components/Sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the main title and quick tips', () => {
    render(<Sidebar isVisible={true} />);
    
    expect(screen.getByText('Gemini Flow')).toBeInTheDocument();
    
    // Global variables section should no longer be in the sidebar
    expect(screen.queryByText('Global Variables (JSON)')).not.toBeInTheDocument();
    
    // Name and description should no longer be in the sidebar
    expect(screen.queryByText('My Test Canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('A description for the test canvas.')).not.toBeInTheDocument();
    
    // Actions buttons should no longer be in the sidebar
    expect(screen.queryByRole('button', { name: /Export/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import/i })).not.toBeInTheDocument();

    // Check for the new tip
    expect(screen.getByText('• Click the arrow to toggle this sidebar.')).toBeInTheDocument();
  });
});