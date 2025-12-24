class TrendsBarChart {
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

  columnTemplate({year, month, value}) {
    const columnElement = document.createElement('column');
    columnElement.innerHTML = `
      <bar style="--length: ${value / this.maximum * 100}%"></bar>
      <count>${this.formatNumber(value)}</count>
      <month>${month}</month>
    `;
    return columnElement;
  }

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

  adaptData(monthsData) {
    const returnData = [];
    const firstYear = Math.min(...monthsData.map(item => Number(item.month.split('-')[0])));
    const firstMonth = Math.min(...monthsData.map(item => Number(item.month.split('-')[1])));
    for (let year = firstYear; year <= new Date().getFullYear(); year++) {
      for (let month = 1; month <= 12; month++) {
        if (year === firstYear && month < firstMonth) continue;
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

  formatNumber(number) {
    return Number(number).toLocaleString();
  }

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

  open(domElement) {
    this.closeButton.addEventListener('click', this.boundClose);
    this.overlayElement.addEventListener('click', this.boundClose);

    this.containerElement.appendChild(domElement);

    document.body.appendChild(this.overlayElement);
    document.body.appendChild(this.containerElement);
  }

  close() {
    this.closeButton.removeEventListener('click', this.boundClose);
    this.overlayElement.removeEventListener('click', this.boundClose);
    this.containerElement.innerHTML = '';
    this.containerElement.remove();
    this.overlayElement.remove();
  }
}