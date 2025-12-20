// Top of file: declare global once
declare global {
  interface Window {
    customCards: any[];
  }
}

// Imports
import { css, CSSResult, html, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { HomeAssistant } from 'custom-card-helpers';
import { ImageSourceConfig, Weather } from '../providers/image';

import {
  configureLogger,
  getLogLevelFromString,
  logger,
  LogLevel,
  ExtendedDateTimeFormatOptions,
  loadTranslationsAsync
} from '../utils';

import { ClockComponent } from '../components/clock';
import { SensorComponent } from '../components/sensors';
import { BackgroundImageComponent } from '../components/background';
import { WeatherComponent } from '../components/weather';
import { TransportationComponent } from '../components/transportation';
import { ActionBarComponent } from '../components/action-bar';
import { BottomBarManager } from '../components/bottom-bar';

import '../components/bottom-bar/bottom-bar-manager';
import '../editors';
import '../components/ha-selector';

import { Messenger, WeatherMessage } from '../utils';
import { WallClockConfig, Size } from './types';

// Webpack injects this constant
declare const PACKAGE_VERSION: string;

@customElement('wall-clock-card-pirateweather')
export class WallClockCard extends LitElement {
  @property({ type: Object }) hass?: HomeAssistant;
  @property({ type: Object }) config: WallClockConfig = {};

  // Components
  private clockComponent = document.createElement('ha-clock') as ClockComponent;
  private sensorComponent = document.createElement('ha-sensors') as SensorComponent;
  private weatherComponent = document.createElement('ha-weather') as WeatherComponent;
  private backgroundImageComponent = document.createElement('ha-background-image') as BackgroundImageComponent;
  private transportationComponent = document.createElement('ha-transportation') as TransportationComponent;
  private actionBarComponent = document.createElement('ha-action-bar') as ActionBarComponent;
  private bottomBarManager: BottomBarManager;

  constructor() {
    super();

    // Log version info
    logger.info(
      "%c WALL-CLOCK-CARD %c " + PACKAGE_VERSION + " ",
      "color: white; background: #3498db; font-weight: 700;",
      "color: #3498db; background: white; font-weight: 700;"
    );

    // Initialize bottom bar manager
    this.bottomBarManager = new BottomBarManager(this);
    this.bottomBarManager.registerComponent(this.transportationComponent);
    this.bottomBarManager.registerComponent(this.actionBarComponent);

    // Setup initial component properties
    this.setupComponents();
  }

  private setupComponents() {
    // Clock
    this.clockComponent.timeFormat = this.config.timeFormat;
    this.clockComponent.dateFormat = this.config.dateFormat;
    this.clockComponent.language = this.config.language;
    this.clockComponent.timeZone = this.config.timeZone;
    this.clockComponent.fontColor = this.config.fontColor;
    this.clockComponent.size = this.config.size;
    if (this.config.customSizes) {
      this.clockComponent.clockSize = this.config.customSizes.clockSize;
      this.clockComponent.dateSize = this.config.customSizes.dateSize;
      this.clockComponent.clockTopMargin = this.config.customSizes.clockTopMargin;
    }

    // Sensors
    this.sensorComponent.sensors = this.config.sensors;
    this.sensorComponent.fontColor = this.config.fontColor;
    this.sensorComponent.size = this.config.size;
    if (this.config.customSizes) {
      this.sensorComponent.labelSize = this.config.customSizes.labelSize;
      this.sensorComponent.valueSize = this.config.customSizes.valueSize;
    }
    if (this.hass) this.sensorComponent.hass = this.hass;

    // Weather
    this.weatherComponent.showWeather = this.config.showWeather;
    this.weatherComponent.weatherProvider = this.config.weatherProvider;
    this.weatherComponent.weatherConfig = this.config.weatherConfig;
    this.weatherComponent.weatherDisplayMode = this.config.weatherDisplayMode;
    this.weatherComponent.weatherForecastDays = this.config.weatherForecastDays;
    this.weatherComponent.weatherTitle = this.config.weatherTitle;
    this.weatherComponent.weatherUpdateInterval = this.config.weatherUpdateInterval;
    this.weatherComponent.fontColor = this.config.fontColor;
    this.weatherComponent.language = this.config.language;
    this.weatherComponent.size = this.config.size;
    if (this.config.customSizes) {
      this.weatherComponent.labelSize = this.config.customSizes.labelSize;
      this.weatherComponent.valueSize = this.config.customSizes.valueSize;
    }

    // Transportation
    this.transportationComponent.transportation = this.config.transportation;
    this.transportationComponent.fontColor = this.config.fontColor;

    // Action Bar
    const actionBar = this.config.actionBar
      ? { ...this.config.actionBar, enabled: this.config.enableActionBar === true }
      : { actions: [], enabled: this.config.enableActionBar === true };
    this.config = { ...this.config, actionBar };
    this.actionBarComponent.config = this.config.actionBar;
    this.actionBarComponent.fontColor = this.config.fontColor;
    this.actionBarComponent.size = this.config.size;
    if (this.config.customSizes) {
      this.actionBarComponent.iconSize = this.config.customSizes.actionBarIconSize;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.initBackgroundImageComponent();

    // Re-apply component properties
    this.setupComponents();

    this.initConnectCallbackAsync();
  }

  private initBackgroundImageComponent() {
    const imageSourceConfig: ImageSourceConfig = {
      imageSourceId: this.config.imageSource || 'picsum',
      backgroundImages: this.config.backgroundImages,
      entity: this.config.imageConfig?.entity,
      apiKey: this.config.imageConfig?.apiKey,
      contentFilter: this.config.imageConfig?.contentFilter,
      category: this.config.imageConfig?.category,
      count: this.config.imageConfig?.count,
    };
    this.backgroundImageComponent.backgroundOpacity =
      this.config.backgroundOpacity ?? 0.5;
    this.backgroundImageComponent.config = {
      imageSourceConfig,
      backgroundRotationInterval: this.config.backgroundRotationInterval,
    };
    this.backgroundImageComponent.hass = this.hass;
    logger.debug('Background image component initialized');
  }

  async initConnectCallbackAsync() {
    await Promise.all([
      this.weatherComponent.controller.ready,
      this.backgroundImageComponent.controller.ready,
      this.clockComponent.controller.ready,
      this.sensorComponent.controller.ready,
      this.transportationComponent.controller.ready,
      this.actionBarComponent.controller.ready,
    ]);

    this.transportationComponent.fontColor = this.config.fontColor;
    this.transportationComponent.transportation = this.config.transportation;

    const logLevel = getLogLevelFromString(this.config.logLevel || 'info');
    configureLogger({
      level: logLevel,
      prefix: 'wall-clock',
      enableSourceTracking: true,
      enableTimestamps: true,
      logToConsole: true,
      logToStorage: false,
    });

    try {
      await loadTranslationsAsync();
      logger.debug('Loaded translations for all languages');
    } catch (error) {
      logger.error('Error loading translations:', error);
    }

    if (!this.config.showWeather) {
      Messenger.getInstance().publish(new WeatherMessage(Weather.All));
    }
  }

  static styles: CSSResult = css`
    ${unsafeCSS(ClockComponent.styles)}
    ${unsafeCSS(SensorComponent.styles)}
    ${unsafeCSS(BackgroundImageComponent.styles)}
    ${unsafeCSS(WeatherComponent.styles)}
    ${unsafeCSS(TransportationComponent.styles)}
    ${unsafeCSS(ActionBarComponent.styles)}
    ${unsafeCSS(BottomBarManager.styles)}
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100%;
      width: 100%;
      color: var(--primary-text-color, #fff);
      font-family: var(--paper-font-common-base, "Roboto", sans-serif);
      position: relative;
      overflow: hidden;
      border-radius: var(--ha-card-border-radius, 4px);
      padding: 0;
      box-sizing: border-box;
    }
    ha-card {
      width: 100%;
      overflow: hidden;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      position: relative;
    }
  `;

  render() {
    const hasBottomBar = this.bottomBarManager?.currentComponent !== null;
    const clockMarginStyle = hasBottomBar ? 'margin-top: -140px;' : '';

    return html`
      <ha-card style="color: rgb(${this.config.fontColor});">
        ${this.backgroundImageComponent}
        ${this.sensorComponent}
        ${this.config.showWeather
          ? html`<div style="position: absolute; top: 16px; right: 16px; max-width: 40%; max-height: 60%; z-index: 3; padding-left: 8px;">
              ${this.weatherComponent}
            </div>`
          : ''}
        <div style="${clockMarginStyle}">${this.clockComponent}</div>
        ${this.bottomBarManager.render()}
      </ha-card>
    `;
  }
}

// ------------------- Registration outside class -------------------
// Register component if not already registered
if (!customElements.get('wall-clock-card-pirateweather')) {
  customElements.define('wall-clock-card-pirateweather', WallClockCard);
}

// Register in Home Assistant's custom card registry
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'wall-clock-card-pirateweather',
  name: 'Wall Clock Card Pirate Weather',
  description:
    'A beautiful clock card with weather forecast, sensors, transportation info, and dynamic backgrounds',
  preview: true,
  documentationURL: 'https://github.com/rkotulan/ha-wall-clock-card',
});

// Log registration success
logger.info(
  "%c WALL-CLOCK-CARD-PIRATEWEATHER %c Successfully Registered ",
  'color: white; background: #27ae60; font-weight: 700;',
  'color: #27ae60; background: white; font-weight: 700;'
);
