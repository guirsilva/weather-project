import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { WeatherService } from './weather.service';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Controller('weather')
export class WeatherController {
  private genAI: GoogleGenerativeAI;
  constructor(private readonly weatherService: WeatherService) { this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string); }

  @Get()
  getLatestWeather() {
    const message = this.weatherService.getLastMessage();
    if (!message) {
      return { message: 'No weather data available yet' };
    }
    return message;
  }

  @Get('export/csv')
  exportToCsv(@Res() res: Response) {
    const message = this.weatherService.getLastMessage();
    
    if (!message) {
      return res.status(404).json({ message: 'No weather data available yet' });
    }

    const flattenedData = {
      latitude: message.location?.latitude,
      longitude: message.location?.longitude,
      city: message.location?.city,
      region: message.location?.region,
      country: message.location?.country,
      weatherData: JSON.stringify(message.weather)
    };

    const headers = Object.keys(flattenedData);
    const csvHeaders = headers.join(',');
    const csvValues = headers.map(header => `"${flattenedData[header]}"`).join(',');
    const csv = `${csvHeaders}\n${csvValues}`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=weather.csv');
    res.send(csv);
  }

  @Get('export/xlsx')
  exportToXlsx(@Res() res: Response) {
    const message = this.weatherService.getLastMessage();
    
    if (!message) {
      return res.status(404).json({ message: 'No weather data available yet' });
    }

    const flattenedData = {
      latitude: message.location?.latitude,
      longitude: message.location?.longitude,
      city: message.location?.city,
      region: message.location?.region,
      country: message.location?.country,
      weatherData: JSON.stringify(message.weather)
    };

    const worksheet = XLSX.utils.json_to_sheet([flattenedData]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Weather');

    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=weather.xlsx');
    res.send(buffer);
  }

  @Get('insights')
  async getWeatherInsights() {
    const message = this.weatherService.getLastMessage();
    
    if (!message) {
      return { message: 'No weather data available yet' };
    }

    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `Based on the following weather data: ${JSON.stringify(message)}, 
      provide 1 practical and direct recommendation for people to prepare for the weather.
      It can be related to: recommended clothing, accessories (umbrella, sunscreen, etc), health warnings.`;

    try {
      const result = await model.generateContent(prompt);
      const insights = result.response.text();
      
      return {
        timestamp: new Date(),
        insights: insights
      };
    } catch (error) {
      return {
        error: 'Failed to generate insights',
        message: error.message
      };
    }
  }
}