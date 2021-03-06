import { Component, createRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartControls from '../ChartControls';
import annotationPlugin from 'chartjs-plugin-annotation';
import PropTypes from 'prop-types';
import './Chart.scss';

Chart.register(...registerables);
Chart.register(annotationPlugin);

function sanitizeData(data) {
	return data.filter(
		value =>
			value !== null &&
			value !== undefined &&
			typeof value === 'number' &&
			!isNaN(value)
	);
}

function linearRegression(data) {
	const input = sanitizeData(data);
	const n = input.length;
	let xSum = 0;
	let ySum = 0;
	let xSquaredSum = 0;
	let xySum = 0;

	input.forEach((y, x) => {
		ySum += y;
		xSum += x;
		xSquaredSum += x * x;
		xySum += x * y;
	});

	const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
	const yIntercept = (ySum - slope * xSum) / n;

	let regressedData = [];

	for (let x = 0; x < n; x++) {
		regressedData.push(Math.floor(slope * x + yIntercept));
	}

	return regressedData;
}

class PieChart extends Component {
	constructor(props) {
		super(props);

		this.ref = createRef();
		this.state = {
			chart: null
		};
	}

	componentDidMount() {
		const ctx = this.ref.current.getContext('2d');

		const data = {
			labels: this.props.labels.map(([label]) => label),
			datasets: [
				{
					label: this.props.label,
					backgroundColor: context => {
						const chartArea = context.chart.chartArea;
						if (!chartArea) return;

						const color = this.props.labels[context.dataIndex][1];

						const centerX = (chartArea.left + chartArea.right) / 2;
						const centerY = (chartArea.top + chartArea.bottom) / 2;
						const r = Math.min(
							(chartArea.right - chartArea.left) / 2,
							(chartArea.bottom - chartArea.top) / 2
						);

						let gradient = ctx.createRadialGradient(
							centerX,
							centerY,
							0,
							centerX,
							centerY,
							r
						);
						gradient.addColorStop(0, 'rgba(255, 99, 132, 0.4)');
						gradient.addColorStop(1, color);

						return gradient;
					},
					fill: true,
					borderColor: 'rgb(255, 99, 132)',
					lineTension: 0.12,
					data: this.props.data,
					barThickness: 7
				}
			]
		};

		const config = {
			type: this.props.type ?? 'pie',
			data: data,
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					title: {
						display: true,
						text: this.props.label
					}
				}
			}
		};

		if (config.type !== 'pie') {
			config.options.scales = {
				r: {
					ticks: {
						backdropColor: 'rgba(0, 0, 0, 0)'
					}
				}
			};
		}

		this.state.chart = new Chart(ctx, config);
	}

	render() {
		let chart = this.state?.chart;
		let options = Chart.overrides[chart?.config?.type];

		if (options) {
			const color = this.props.theme === 'light' ? 'black' : '#aaa';

			options.plugins.title = {
				color: color
			};

			options.plugins.legend = {
				labels: {
					color: color
				}
			};

			chart.update();
		}

		return (
			<div className="chart-container pie-chart-container">
				<canvas ref={this.ref}></canvas>
			</div>
		);
	}
}

PieChart.propTypes = {
	data: PropTypes.arrayOf(PropTypes.number).isRequired,
	label: PropTypes.string.isRequired,
	type: PropTypes.string,
	theme: PropTypes.string
};

class DataChart extends Component {
	constructor(props) {
		super(props);

		this.ref = createRef();
		this.state = {
			chart: null
		};
	}

	componentDidMount() {
		const ctx = this.ref.current.getContext('2d');
		const regressedData = linearRegression(this.props.data);

		const data = {
			labels: this.props.labels,
			datasets: [
				{
					label: this.props.label,
					backgroundColor: context => {
						const chartArea = context.chart.chartArea;
						if (!chartArea) return;

						const centerY = (chartArea.top + chartArea.bottom) / 2;

						let gradient = ctx.createLinearGradient(
							0,
							centerY,
							0,
							chartArea.bottom
						);
						gradient.addColorStop(0, 'rgba(255, 99, 132, 0.7)');
						gradient.addColorStop(1, 'rgba(255, 99, 132, 0)');

						return gradient;
					},
					fill: true,
					borderColor: 'rgb(255, 99, 132)',
					lineTension: 0.12,
					data: this.props.data,
					barThickness: 7
				}
			]
		};

		if (this.props.predictedEnabled) {
			data.datasets.push({
				label: `Predicted ${this.props.label}`,
				backgroundColor: this.props.predictedEnabled
					? 'rgb(0, 0, 0)'
					: 'rgba(0, 0, 0, 0)',
				fill: false,
				borderColor: this.props.predictedEnabled
					? 'rgb(0, 0, 0)'
					: 'rgba(0, 0, 0, 0)',
				data: regressedData,
				pointRadius: 0
			});
		}

		/* Under review */
		function average(ctx) {
			const values = ctx.chart.data.datasets[0].data;

			return values.reduce((a, b) => a + b, 0) / values.length;
		}

		const annotation = {
			type: 'line',
			borderColor: 'black',
			borderDash: [5, 5],
			borderDashOffset: 0,
			borderWidth: 2,
			label: {
				enabled: true,
				content: context => 'Average: ' + Math.floor(average(context)),
				position: 'end'
			},
			scaleID: 'y',
			value: context => Math.floor(average(context))
		};
		/* Under review */

		const config = {
			type: this.props.defaultChartType ?? 'line',
			data: data,
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					annotation: {
						annotations: [annotation]
					}
				}
			}
		};

		this.state.chart = new Chart(ctx, config);
	}

	render() {
		let chart = this.state?.chart;
		let options = chart?.config?.options;

		if (options) {
			const color = this.props.theme === 'light' ? 'black' : '#aaa';

			options.plugins.legend = {
				labels: {
					color: color
				}
			};
			options.scales.y.ticks.color = color;
			options.scales.x.ticks.color = color;
			chart.update();
		}

		return (
			<div className="controls-container">
				<ChartControls
					searchEnabled={this.props.searchEnabled}
					averageEnabled={this.props.averageEnabled}
					predictedEnabled={this.props.predictedEnabled}
					chartState={this.state}
					defaultChartType={this.props.defaultChartType}
				/>

				<div className="chart-container">
					<canvas ref={this.ref}></canvas>
				</div>
			</div>
		);
	}
}

DataChart.propTypes = {
	data: PropTypes.arrayOf(PropTypes.number).isRequired,
	labels: PropTypes.arrayOf(PropTypes.string).isRequired,
	label: PropTypes.string.isRequired,
	averageEnabled: PropTypes.bool,
	predictedEnabled: PropTypes.bool,
	defaultChartType: PropTypes.string,
	searchEnabled: PropTypes.bool,
	theme: PropTypes.string
};

DataChart.defaultProps = {
	defaultChartType: 'line'
};

export { DataChart, PieChart };
