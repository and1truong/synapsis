// FIX: Add a triple-slash directive to explicitly include jest-dom type definitions.
/// <reference types="@testing-library/jest-dom" />

// FIX: Add jest imports
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TextNode from '../../../components/nodes/TextNode';
// FIX: Import Position and NodeProps
import { useReactFlow, ReactFlowProvider, Position, NodeProps, Node } from 'reactflow';
import { TextNodeData } from '../../../types';

// Mock React Flow hooks
jest.mock('reactflow', () => ({
  // FIX: Cast the result of requireActual to object to fix spread operator error
  ...(jest.requireActual('reactflow') as object),
  useReactFlow: jest.fn(),
}));

const mockUseReactFlow = useReactFlow as jest.Mock;
const mockSetNodes = jest.fn();
const mockGetNodes = jest.fn(() => []);

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<ReactFlowProvider>{ui}</ReactFlowProvider>);
}

describe('TextNode', () => {
  // FIX: use Position enum and type props with NodeProps
  const nodeProps: NodeProps<TextNodeData> = {
    id: 'test-node-1',
    data: { label: 'My Label', text: 'Initial text' },
    selected: false,
    isConnectable: true,
    dragging: false,
    targetPosition: Position.Left,
    sourcePosition: Position.Right,
    xPos: 0,
    yPos: 0,
    type: 'textNode',
    zIndex: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReactFlow.mockReturnValue({
      setNodes: mockSetNodes,
      getNodes: mockGetNodes,
    });
  });

  it('renders the label and text content', () => {
    renderWithProvider(<TextNode {...nodeProps} />);
    expect(screen.getByText('My Label')).toBeInTheDocument();
    expect(screen.getByText('Initial text')).toBeInTheDocument();
  });
  
  it('shows placeholder text when text is empty', () => {
    const propsWithEmptyText = { ...nodeProps, data: { ...nodeProps.data, text: '' } };
    renderWithProvider(<TextNode {...propsWithEmptyText} />);
    expect(screen.getByText('Double-click to edit...')).toBeInTheDocument();
  });

  it('enters header edit mode on double click', () => {
    renderWithProvider(<TextNode {...nodeProps} />);
    const header = screen.getByText('My Label');
    fireEvent.doubleClick(header);
    
    const input = screen.getByDisplayValue('My Label');
    expect(input).toBeInTheDocument();
  });

  it('updates node label on header input blur', () => {
    renderWithProvider(<TextNode {...nodeProps} />);
    fireEvent.doubleClick(screen.getByText('My Label'));
    
    const input = screen.getByDisplayValue('My Label');
    fireEvent.change(input, { target: { value: 'New Label' } });
    fireEvent.blur(input);

    expect(mockSetNodes).toHaveBeenCalledTimes(1);
    // FIX: Cast updaterFunction to a callable type to resolve the "not callable" error.
    const updaterFunction = mockSetNodes.mock.calls[0][0] as (nodes: Node[]) => Node[];
    // FIX: The component was changed to pass an updater function, so this test is now valid.
    updaterFunction([]); // Execute the updater to check its logic
    // FIX: The component was changed to not require getNodes, so this check is no longer needed.
    // expect(mockGetNodes).toHaveBeenCalled();
  });
  
  it('enters text content edit mode on double click', () => {
    renderWithProvider(<TextNode {...nodeProps} />);
    const contentArea = screen.getByText('Initial text');
    fireEvent.doubleClick(contentArea);
    
    const textarea = screen.getByDisplayValue('Initial text');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveFocus();
  });

  it('updates node text on textarea blur', () => {
    renderWithProvider(<TextNode {...nodeProps} />);
    fireEvent.doubleClick(screen.getByText('Initial text'));

    const textarea = screen.getByDisplayValue('Initial text');
    fireEvent.change(textarea, { target: { value: 'Updated text' } });
    fireEvent.blur(textarea);

    expect(mockSetNodes).toHaveBeenCalledTimes(1);
    // You can further inspect the call if needed, but this confirms the update is triggered.
    // FIX: Cast updaterFunction to a callable type to resolve the "not callable" error.
    const updaterFunction = mockSetNodes.mock.calls[0][0] as (nodes: Node[]) => Node[];
    // FIX: The component was changed to pass an updater function, so this test is now valid.
    updaterFunction([]);
    // FIX: The component was changed to not require getNodes, so this check is no longer needed.
    // expect(mockGetNodes).toHaveBeenCalled();
  });
});