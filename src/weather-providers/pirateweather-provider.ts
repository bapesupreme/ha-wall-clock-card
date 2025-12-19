import { WeatherProvider, WeatherData, WeatherProviderConfig } from './types';
import { Weather } from '../image-sources';

// Define DailyWeather locally since it's not exported from types

interface PirateWeatherCurrently {
    time: number;
    summary: string;
    icon: string;
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windGust?: number;
    windBearing: number;
    cloudCover: number;
    uvIndex: number;
    visibility: number;
}

interface PirateWeatherDaily {
    time: number;
    summary: string;
    icon: string;
    temperatureHigh: number;
    temperatureLow: number;
    temperatureMax: number;
    temperatureMin: number;
    apparentTemperatureHigh: number;
    apparentTemperatureLow: number;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windGust?: number;
    windBearing: number;
    cloudCover: number;
    uvIndex: number;
}

interface PirateWeatherResponse {
    latitude: number;
    longitude: number;
    timezone: string;
    currently: PirateWeatherCurrently;
    daily: {
        summary: string;
        icon: string;
        data: PirateWeatherDaily[];
    };
}

interface DailyWeather {
    date: Date;
    temperatureMax: number;
    temperatureMin: number;
    condition: string;
    conditionUnified: Weather;
    icon: string;
    humidity: number;
    pressure: number;
    windSpeed: number;
    windGust?: number;
    windBearing: number;
    cloudCover: number;
    uvIndex: number;
}

export class PirateWeatherProvider implements WeatherProvider {
    readonly id = 'pirateweather';
    readonly name = 'Pirate Weather';
    readonly description = 'Pirate Weather API provider for weather data';
    private readonly baseUrl = 'https://api.pirateweather.net/forecast';

    getDefaultConfig(): WeatherProviderConfig {
        return {
            apiKey: '',
            latitude: 0,
            longitude: 0,
            units: 'metric' // Changed from 'us' to 'metric'
        };
    }

    async fetchWeatherAsync(config: WeatherProviderConfig): Promise<WeatherData> {
        if (!config.apiKey) {
            throw new Error('Pirate Weather API key is required');
        }

        if (!config.latitude || !config.longitude) {
            throw new Error('Latitude and longitude are required');
        }

        // Build the API URL - map metric/imperial to Pirate Weather units
        const pirateUnits = this.mapUnits(config.units || 'metric');
        const url = `${this.baseUrl}/${config.apiKey}/${config.latitude},${config.longitude}?units=${pirateUnits}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Pirate Weather API error: ${response.status} ${response.statusText}`);
            }

            const data: PirateWeatherResponse = await response.json();

            return this.transformResponse(data);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch Pirate Weather data: ${error.message}`);
            }
            throw new Error('Failed to fetch Pirate Weather data');
        }
    }

    private mapUnits(units: string): string {
        // Map standard units to Pirate Weather units
        const unitsMap: Record<string, string> = {
            'metric': 'si',
            'imperial': 'us'
        };
        return unitsMap[units] || 'si';
    }

    private transformResponse(data: PirateWeatherResponse): WeatherData {
        const currently = data.currently;
        const daily = data.daily.data;

        // Map Pirate Weather icon to unified condition
        const conditionUnified = this.mapIconToCondition(currently.icon);

        // Get icon URL
        const currentIcon = this.getIconUrl(currently.icon);

        // Convert wind bearing to direction string
        const windDirection = this.bearingToDirection(currently.windBearing);

        return {
            current: {
                temperature: currently.temperature,
                feelsLike: currently.apparentTemperature,
                condition: this.formatCondition(currently.summary),
                conditionUnified: conditionUnified,
                icon: currentIcon,
                humidity: currently.humidity * 100, // Convert from 0-1 to 0-100
                pressure: currently.pressure,
                windSpeed: currently.windSpeed,
                windDirection: windDirection,
                uvIndex: currently.uvIndex
            },
            daily: daily.slice(0, 7).map(day => this.transformDailyWeather(day))
        };
    }

    private transformDailyWeather(day: PirateWeatherDaily): DailyWeather {
        return {
            date: new Date(day.time * 1000),
            temperatureMax: day.temperatureMax || day.temperatureHigh,
            temperatureMin: day.temperatureMin || day.temperatureLow,
            condition: this.formatCondition(day.summary),
            conditionUnified: this.mapIconToCondition(day.icon),
            icon: this.getIconUrl(day.icon),
            humidity: day.humidity * 100,
            pressure: day.pressure,
            windSpeed: day.windSpeed,
            windGust: day.windGust,
            windBearing: day.windBearing,
            cloudCover: day.cloudCover * 100,
            uvIndex: day.uvIndex
        };
    }

    /**
     * Map Pirate Weather icon codes to unified Weather conditions
     */
    private mapIconToCondition(icon: string): Weather {
        const iconMap: Record<string, Weather> = {
            'clear-day': Weather.ClearSky,
            'clear-night': Weather.ClearSky,
            'rain': Weather.Rain,
            'snow': Weather.Snow,
            'sleet': Weather.Snow,
            'wind': Weather.Clouds,
            'fog': Weather.Mist,
            'cloudy': Weather.Clouds,
            'partly-cloudy-day': Weather.Clouds,
            'partly-cloudy-night': Weather.Clouds,
            'hail': Weather.Snow,
            'thunderstorm': Weather.Rain,
            'tornado': Weather.Clouds
        };

        return iconMap[icon] || Weather.All;
    }

    /**
     * Convert wind bearing (degrees) to direction string
     */
    private bearingToDirection(bearing: number): string {
        const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                           'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(bearing / 22.5) % 16;
        return directions[index];
    }

    /**
     * Get icon URL for a given icon code
     */
    private getIconUrl(icon: string): string {
        const baseIconUrl = 'https://raw.githubusercontent.com/manifestinteractive/weather-underground-icons/master/dist/icons/white/png/64x64';
        
        const iconMapping: Record<string, string> = {
            'clear-day': `${baseIconUrl}/clear.png`,
            'clear-night': `${baseIconUrl}/nt_clear.png`,
            'rain': `${baseIconUrl}/rain.png`,
            'snow': `${baseIconUrl}/snow.png`,
            'sleet': `${baseIconUrl}/sleet.png`,
            'wind': `${baseIconUrl}/wind.png`,
            'fog': `${baseIconUrl}/fog.png`,
            'cloudy': `${baseIconUrl}/cloudy.png`,
            'partly-cloudy-day': `${baseIconUrl}/partlycloudy.png`,
            'partly-cloudy-night': `${baseIconUrl}/nt_partlycloudy.png`,
            'hail': `${baseIconUrl}/sleet.png`,
            'thunderstorm': `${baseIconUrl}/tstorms.png`,
            'tornado': `${baseIconUrl}/tornado.png`
        };

        return iconMapping[icon] || `${baseIconUrl}/cloudy.png`;
    }

    /**
     * Format condition text for display
     */
    private formatCondition(summary: string): string {
        return summary || 'Unknown';
    }
}
