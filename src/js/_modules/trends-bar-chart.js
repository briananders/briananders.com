/**
 * Component that renders monthly scrobble data as a responsive bar chart,
 * organized into year sections with adaptive bar sizing.
 */
class TrendsBarChart {
  /**
   * 1-indexed list of month initial abbreviations for chart labels.
   */
  static monthNames = [
    'Unknown',
    'J', // Jan
    'F', // Feb
    'M', // Mar
    'A', // Apr
    'M', // May
    'J', // Jun
    'J', // Jul
    'A', // Aug
    'S', // Sep
    'O', // Oct
    'N', // Nov
    'D', // Dec
  ];

  /**
   * Creates an instance of TrendsBarChart.
   *
   * @param {HTMLElement} domElement - The target container element.
   * @param {Array<Object>} monthsData - Raw array of month data objects (with .month and .count).
   * @param {Object} [options={}] - Optional configuration.
   * @param {boolean} [options.openInModal=true] - Whether to render inside a modal dialog.
   * @param {number} [options.year] - Restrict the chart to this calendar year.
   */
  constructor(domElement, monthsData, { openInModal = true, year } = {}) {
    this.containerElement = domElement;
    this.monthsData = this.adaptData(monthsData, year);
    this.maximum = Math.max(...this.monthsData.map(item => item.value), 1);
    this.openInModal = openInModal;
    this.modal = this.openInModal ? new Modal() : null;
    this.render();
  }

  /**
   * Calculates adaptive bar dimensions based on total month count.
   * Tries to fit all bars within ~900px, falling back to horizontal scroll
   * for very long date ranges (15+ years).
   *
   * @returns {{ barWidth: number, gap: number, chartHeight: number }}
   */
  getLayout() {
    const count = this.monthsData.length;
    const maxWidth = 900;

    for (const gap of [4, 3, 2, 1]) {
      const barWidth = Math.floor((maxWidth - (count - 1) * gap) / count);
      if (barWidth >= 4) {
        const clamped = Math.min(36, barWidth);
        return {
          barWidth: clamped,
          gap,
          chartHeight: clamped >= 20 ? 200 : clamped >= 10 ? 180 : 160,
        };
      }
    }
    return { barWidth: 4, gap: 1, chartHeight: 150 };
  }

  /**
   * Groups monthsData entries by year.
   *
   * @returns {Object.<number, Array>} Map of year number to array of month entries.
   */
  groupByYear() {
    const groups = {};
    this.monthsData.forEach(item => {
      if (!groups[item.year]) groups[item.year] = [];
      groups[item.year].push(item);
    });
    return groups;
  }

  /**
   * Fills in missing chronological months between start date and current date with zero counts.
   *
   * @param {Array<Object>} monthsData - Raw month records with 'YYYY-MM' strings and counts.
   * @param {number} [selectedYear] - Optional calendar year to display.
   * @returns {Array<{ value: number, month: string, year: number }>} Continuous adapted month data series.
   */
  adaptData(monthsData, selectedYear) {
    const returnData = [];
    const firstYear = selectedYear ?? Math.min(...monthsData.map(item => Number(item.month.split('-')[0])));
    const firstMonth = selectedYear ? 1 : Math.min(...monthsData.map(item => Number(item.month.split('-')[1])));
    for (let year = firstYear; year <= (selectedYear ?? new Date().getFullYear()); year++) {
      for (let month = 1; month <= 12; month++) {
        // Skip months before the starting month in the first year
        if (year === firstYear && month < firstMonth) continue;
        // Skip future months beyond the current month in the current year
        if (year === new Date().getFullYear() && month > new Date().getMonth() + 1) continue;
        const monthData = monthsData.find(item => Number(item.month.split('-')[0]) === year && Number(item.month.split('-')[1]) === month);
        returnData.push({
          value: monthData ? Number(monthData.count) : 0,
          month: TrendsBarChart.monthNames[month],
          year,
        });
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
   * Renders the year-grouped bar chart into the container element and optionally opens a modal.
   *
   * @returns {void}
   */
  render() {
    const { barWidth, gap, chartHeight } = this.getLayout();
    const yearGroups = this.groupByYear();
    const radius = barWidth >= 12 ? 3 : 2;
    const fontSize = barWidth >= 20 ? 11 : barWidth >= 10 ? 10 : barWidth >= 6 ? 8 : 7;
    const showMonths = barWidth >= 5;

    const style = document.createElement('style');
    style.textContent = `
      .tc-wrap {
        padding: 12px 20px 8px;
        overflow-x: auto;
        overflow-y: hidden;
      }
      .tc-bars {
        display: flex;
        gap: ${gap}px;
        align-items: flex-end;
        justify-content: center;
      }
      .tc-col {
        width: ${barWidth}px;
        flex-shrink: 0;
        cursor: default;
        position: relative;
        outline: none;
      }
      .tc-bar-area {
        height: ${chartHeight}px;
        display: flex;
        align-items: flex-end;
      }
      .tc-bar {
        width: 100%;
        background: linear-gradient(var(--palette--primary-color-light), var(--palette--primary-color-dark));
        border-radius: ${radius}px ${radius}px 0 0;
        transition: opacity 0.15s;
      }
      .tc-col:hover .tc-bar,
      .tc-col:focus .tc-bar {
        opacity: 0.75;
      }
      .tc-month {
        font-size: ${fontSize}px;
        line-height: 1.6;
        color: var(--palette--secondary-grey);
        text-align: center;
        overflow: hidden;
        ${showMonths ? '' : 'display: none;'}
      }
      .tc-popover {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        background: var(--palette--primary-grey, #222);
        color: var(--palette--primary-color-light, #fff);
        font-size: 14px;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.12s;
        z-index: 10;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }
      .tc-col:hover .tc-popover,
      .tc-col:focus .tc-popover {
        opacity: 1;
      }
      .tc-years {
        display: flex;
        gap: ${gap}px;
        justify-content: center;
      }
      .tc-year {
        font-size: ${Math.max(fontSize, 9)}px;
        line-height: 1;
        color: var(--palette--secondary-grey);
        text-align: center;
        padding: 4px 0;
        flex-shrink: 0;
        background: var(--palette--hover-grey);
        border-radius: 0 0 ${radius}px ${radius}px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        position: relative;
        outline: none;
        cursor: default;
      }
      .tc-year-popover {
        position: absolute;
        top: calc(100% + 4px);
        left: 50%;
        transform: translateX(-50%);
        background: var(--palette--primary-grey, #222);
        color: var(--palette--primary-color-light, #fff);
        font-size: 11px;
        line-height: 1;
        padding: 4px 6px;
        border-radius: 3px;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.12s;
        z-index: 10;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      }
      .tc-year:hover .tc-year-popover,
      .tc-year:focus .tc-year-popover {
        opacity: 1;
      }
    `;

    const wrap = document.createElement('div');
    wrap.className = 'tc-wrap';
    wrap.appendChild(style);

    // Bar columns
    const barsRow = document.createElement('div');
    barsRow.className = 'tc-bars';

    this.monthsData.forEach(item => {
      const col = document.createElement('div');
      col.className = 'tc-col';
      col.tabIndex = 0;
      col.setAttribute('aria-label', `${item.month} ${item.year}: ${this.formatNumber(item.value)} plays`);

      const popover = document.createElement('div');
      popover.className = 'tc-popover';
      popover.textContent = this.formatNumber(item.value);

      const barArea = document.createElement('div');
      barArea.className = 'tc-bar-area';

      const bar = document.createElement('div');
      bar.className = 'tc-bar';
      const h = this.maximum > 0 ? Math.round(item.value / this.maximum * chartHeight) : 0;
      bar.style.height = `${h}px`;

      const monthLabel = document.createElement('div');
      monthLabel.className = 'tc-month';
      monthLabel.textContent = item.month;

      barArea.appendChild(bar);
      col.appendChild(popover);
      col.appendChild(barArea);
      col.appendChild(monthLabel);
      barsRow.appendChild(col);
    });

    // Year labels row — widths are calculated so each label spans
    // exactly the bar columns belonging to that year.
    const yearsRow = document.createElement('div');
    yearsRow.className = 'tc-years';

    Object.entries(yearGroups).forEach(([year, months]) => {
      const w = months.length * barWidth + Math.max(0, months.length - 1) * gap;
      const yearTotal = months.reduce((sum, m) => sum + m.value, 0);
      const label = document.createElement('div');
      label.className = 'tc-year';
      label.tabIndex = 0;
      label.style.width = `${w}px`;
      label.textContent = w < 30 ? `'${String(year).slice(2)}` : year;
      label.setAttribute('aria-label', `${year}: ${this.formatNumber(yearTotal)} plays`);

      const popover = document.createElement('div');
      popover.className = 'tc-year-popover';
      popover.textContent = `${year}: ${this.formatNumber(yearTotal)}`;
      label.appendChild(popover);

      yearsRow.appendChild(label);
    });

    wrap.appendChild(barsRow);
    wrap.appendChild(yearsRow);
    this.containerElement.appendChild(wrap);

    if (this.modal) {
      this.modal.open(this.containerElement);
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
