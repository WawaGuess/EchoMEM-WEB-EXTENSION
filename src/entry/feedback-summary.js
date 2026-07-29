import {
  renderSummary,
  cleanupSummary,
} from '../panels/feedback/summary/summary-view.js';

const summaryFeedbackView = {
  key: 'summary',
  label: '周期总结',
  mount: (container) => renderSummary(container),
  cleanup: (container) => cleanupSummary(container),
};

globalThis.__ECHOMEM_FEEDBACK_VIEWS__ ||= new Map();
globalThis.__ECHOMEM_FEEDBACK_VIEWS__.set(summaryFeedbackView.key, summaryFeedbackView);
