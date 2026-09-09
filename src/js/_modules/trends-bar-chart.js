/**
 * Component that renders monthly data trends as a responsive bar chart grid.
 */
class TrendsBarChart {
  /**
   * 1-indexed list of month initial abbreviations for chart labels.
   */
  static monthNames = [
    'Unknown',
    'J', // 'Jan',
    'F', // 'Feb',
    'M', // 'Mar',
    'A', // 'Apr',
    'M', // 'May',
    'J', // 'Jun',
    'J', // 'Jul',
    'A', // 'Aug',
    'S', // 'Sep',
    'O', // 'Oct',
    'N', // 'Nov',
    'D', // 'Dec',
  ];

  /**
   * Generates inline CSS grid styles for the bar chart container based on total column count.
   *
   * @param {number} count - The number of month columns to render.
   * @returns {string} CSS styling string for the container element.
   */
  containerStyles(count) {
    return `
      display: grid;
      gap: 4px;
      grid-template-columns: repeat(${count}, 40px);
      justify-content: center;
      width: ${count * 40 + 4 * (count - 1)}px;
      max-width: 100%;
      overflow: auto;
      justify-content: start;
      align-items: end;
    `;
  }

  /**
   * Embedded CSS stylesheet for column and bar visual presentation.
   */
  static columnStyles = `
    column {
      display: grid;
      text-align: center;
      gap: 4px;
      grid-template-rows: 200px 1fr 1fr;
      align-items: flex-end;
      grid-row: 1;
    }
    bar {
      display: block;
      height: var(--length);
      background-color: var(--palette--primary-color-dark);
      background: linear-gradient(var(--palette--primary-color-light), var(--palette--primary-color-dark));
      border-radius: 3px;
      overflow: hidden;
    }
    count, month, year {
      display: block;
    }
    year {
      text-align: center;
      border-radius: 3px;
      grid-row: 2;
      background-color: var(--palette--hover-grey);
    }
  `;

  /**
   * Creates a DOM element representing an individual bar column for a month.
   *
   * @param {Object} options - Month data.
   * @param {number} options.year - Year of the month entry.
   * @param {string} options.month - Month abbreviation label.
   * @param {number} options.value - Numeric count/value for the month.
   * @returns {HTMLElement} The column DOM element.
   */
  columnTemplate({ year, month, value }) {
    const columnElement = document.createElement('column');
    columnElement.innerHTML = `
      <bar style="--length: ${value / this.maximum * 100}%"></bar>
      <count>${this.formatNumber(value)}</count>
      <month>${month}</month>
    `;
    return columnElement;
  }

  /**
   * Creates an instance of TrendsBarChart.
   *
   * @param {HTMLElement} domElement - The target container element.
   * @param {Array<Object>} monthsData - Raw array of month data objects (with .month and .count).
   * @param {Object} [options={}] - Optional configuration.
   * @param {boolean} [options.openInModal=true] - Whether to render inside a modal dialog.
   */
  constructor(domElement, monthsData, { openInModal = true } = {}) {
    this.containerElement = domElement;
    this.monthsData = this.adaptData(monthsData);
    this.maximum = Math.max(...this.monthsData.map(item => item.value));
    this.openInModal = openInModal;
    this.modal = this.openInModal ? new Modal() : null;

    this.containerElement.style.cssText = this.containerStyles(this.monthsData.length);
    const style = document.createElement('style');
    style.innerHTML = TrendsBarChart.columnStyles;
    this.containerElement.appendChild(style);

    this.render();
  }

  /**
   * Fills in missing chronological months between start date and current date with zero counts.
   *
   * @param {Array<Object>} monthsData - Raw month records with 'YYYY-MM' strings and counts.
   * @returns {Array<{ value: number, month: string, year: number }>} Continuous adapted month data series.
   */
  adaptData(monthsData) {
    const returnData = [];
    const firstYear = Math.min(...monthsData.map(item => Number(item.month.split('-')[0])));
    const firstMonth = Math.min(...monthsData.map(item => Number(item.month.split('-')[1])));
    for (let year = firstYear; year <= new Date().getFullYear(); year++) {
      for (let month = 1; month <= 12; month++) {
        // Skip months before the starting month in the first year
        if (year === firstYear && month < firstMonth) continue;
        // Skip future months beyond the current month in the current year
        if (year === new Date().getFullYear() && month > new Date().getMonth() + 1) continue;
        const monthData = monthsData.find(item => Number(item.month.split('-')[0]) === year && Number(item.month.split('-')[1]) === month);
        if (monthData) {
          returnData.push({
            value: Number(monthData.count),
            month: TrendsBarChart.monthNames[month],
            year: year,
          });
        } else {
          returnData.push({
            value: 0,
            month: TrendsBarChart.monthNames[month],
            year: year,
          });
        }
      }
    }
    return returnData;
  }

  /**
   * Formats a raw number into a locale-formatted string with comma separators.
   *
   * @param {number|string} number - The number to format.
   * @returns {string} Formatted number string.
   */
  formatNumber(number) {
    return Number(number).toLocaleString();
  }

  /**
   * Renders bar columns and year spans into the container and displays in a modal if enabled.
   *
   * @returns {void}
   */
  render() {
    const containerElement = this.containerElement;
    const years = [];
    this.monthsData.forEach(item => {
      containerElement.appendChild(this.columnTemplate(item));
      if (!years.includes(item.year)) {
        years.push(item.year);
        const yearData = this.monthsData.filter(month => month.year === item.year);
        const yearElement = document.createElement('year');
        yearElement.style.gridColumn = `span ${yearData.length}`;
        yearElement.innerHTML = item.year;
        containerElement.appendChild(yearElement);
      }
    });
    if (this.modal) {
      this.modal.open(containerElement);
    }
  }
}

module.exports = TrendsBarChart;

/**
 * Modal dialog overlay for displaying embedded components.
 */
class Modal {
  static OVERLAY_STYLE = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1000;
  `;

  static CONTAINER_STYLE = `
    position: fixed;
    top: 0;
    left: 0;
    display: grid;
    z-index: 1001;
    width: 100vw;
    height: 100vh;
    justify-content: center;
    align-items: center;
  `;

  static CLOSE_BUTTON_STYLE = `
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 1002;
  `;

  /**
   * Creates an instance of Modal, preparing container, overlay, and close button elements.
   */
  constructor() {
    this.containerElement = document.createElement('div');
    this.containerElement.style.cssText = Modal.CONTAINER_STYLE;
    this.overlayElement = document.createElement('div');
    this.overlayElement.style.cssText = Modal.OVERLAY_STYLE;
    this.closeButton = document.createElement('button');
    this.closeButton.style.cssText = Modal.CLOSE_BUTTON_STYLE;
    this.closeButton.innerHTML = 'Close';
    this.containerElement.appendChild(this.closeButton);

    this.boundClose = this.close.bind(this);
  }

  /**
   * Opens the modal dialog and appends the specified DOM element content.
   *
   * @param {HTMLElement} domElement - The content element to show inside the modal.
   * @returns {void}
   */
  open(domElement) {
    this.closeButton.addEventListener('click', this.boundClose);
    this.overlayElement.addEventListener('click', this.boundClose);

    this.containerElement.appendChild(domElement);

    document.body.appendChild(this.overlayElement);
    document.body.appendChild(this.containerElement);
  }

  /**
   * Closes the modal dialog and removes overlay and container from the DOM.
   *
   * @returns {void}
   */
  close() {
    this.closeButton.removeEventListener('click', this.boundClose);
    this.overlayElement.removeEventListener('click', this.boundClose);
    this.containerElement.innerHTML = '';
    this.containerElement.remove();
    this.overlayElement.remove();
  }
}