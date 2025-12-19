import { WeatherProvider, WeatherData, WeatherProviderConfig, DailyWeather } from './types';
import { Weather } from '../image-sources';

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

export class PirateWeatherProvider implements WeatherProvider {
    readonly id = 'pirateweather';
    readonly name = 'Pirate Weather';
    private readonly baseUrl = 'https://api.pirateweather.net/forecast';

    getDefaultConfig(): WeatherProviderConfig {
        return {
            apiKey: '',
            latitude: 0,
            longitude: 0,
            units: 'us' // us, si, ca, uk2
        };
    }

    async fetchWeatherAsync(config: WeatherProviderConfig): Promise<WeatherData> {
        if (!config.apiKey) {
            throw new Error('Pirate Weather API key is required');
        }

        if (!config.latitude || !config.longitude) {
            throw new Error('Latitude and longitude are required');
        }

        // Build the API URL
        const units = config.units || 'us';
        const url = `${this.baseUrl}/${config.apiKey}/${config.latitude},${config.longitude}?units=${units}`;

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Pirate Weather API error: ${response.status} ${response.statusText}`);
            }

            const data: PirateWeatherResponse = await response.json();

            return this.transformResponse(data, units);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to fetch Pirate Weather data: ${error.message}`);
            }
            throw new Error('Failed to fetch Pirate Weather data');
        }
    }

    private transformResponse(data: PirateWeatherResponse, units: string): WeatherData {
        const currently = data.currently;
        const daily = data.daily.data;

        // Map Pirate Weather icon to unified condition
        const conditionUnified = this.mapIconToCondition(currently.icon);

        // Get icon URL
        const currentIcon = this.getIconUrl(currently.icon);

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
                windGust: currently.windGust,
                windBearing: currently.windBearing,
                cloudCover: currently.cloudCover * 100, // Convert from 0-1 to 0-100
                uvIndex: currently.uvIndex,
                visibility: currently.visibility
            },
            daily: daily.slice(0, 7).map(day => this.transformDailyWeather(day, units)),
            location: {
                latitude: data.latitude,
                longitude: data.longitude,
                timezone: data.timezone
            },
            units: this.getUnitsDescription(units)
        };
    }

    private transformDailyWeather(day: PirateWeatherDaily, units: string): DailyWeather {
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
            'clear-day': Weather.Sunny,
            'clear-night': Weather.ClearNight,
            'rain': Weather.Rainy,
            'snow': Weather.Snowy,
            'sleet': Weather.Snowy,
            'wind': Weather.Windy,
            'fog': Weather.Foggy,
            'cloudy': Weather.Cloudy,
            'partly-cloudy-day': Weather.PartlyCloudy,
            'partly-cloudy-night': Weather.PartlyCloudyNight,
            'hail': Weather.Hail,
            'thunderstorm': Weather.Lightning,
            'tornado': Weather.Exceptional
        };

        return iconMap[icon] || Weather.All;
    }

    /**
     * Get icon URL for a given icon code
     * You can customize this to use your own icon set
     */
    private getIconUrl(icon: string): string {
        // Using a simple mapping - you can replace with your own icon URLs
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

    /**
     * Get units description
     */
    private getUnitsDescription(units: string): string {
        const unitsMap: Record<string, string> = {
            'us': 'imperial', // Fahrenheit, mph, inches
            'si': 'metric',   // Celsius, m/s, mm
            'ca': 'metric',   // Celsius, km/h, mm
            'uk2': 'hybrid'   // Celsius, mph, mm
        };

        return unitsMap[units] || 'imperial';
    }
}
