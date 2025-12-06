import json
import requests
import pika
import time
import schedule

def get_location_from_ip():
    try:
        response = requests.get("http://ip-api.com/json/")
        data = response.json()
        return {
            "latitude": data.get("lat"),
            "longitude": data.get("lon"),
            "city": data.get("city"),
            "region": data.get("regionName"),
            "country": data.get("country")
        }
    except Exception as e:
        print("Could not reach location:", e)
        return None

def get_weather_from_open_meteo(lat, lon):
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "temperature_2m,relative_humidity_2m",
            "timezone": "America/Recife"
        }
        response = requests.get(url, params=params)
        return response.json()
    except Exception as e:
        print("Error during Open-Meteo search:", e)
        return None

def send_to_rabbitmq(queue_name, data):
    try:
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(host="localhost")
        )
        channel = connection.channel()
        channel.queue_declare(queue=queue_name, durable=True)
        channel.basic_publish(
            exchange="",
            routing_key=queue_name,
            body=json.dumps(data)
        )
        print(f"Message sent to queue '{queue_name}' at {time.strftime('%Y-%m-%d %H:%M:%S')}")
        connection.close()
    except Exception as e:
        print("Error while sending to RabbitMQ:", e)

def fetch_and_send_weather():
    location = get_location_from_ip()
    if not location:
        print("Could not reach location.")
        return

    lat = location["latitude"]
    lon = location["longitude"]
    print(f"Location found: {location['city']} - {location['region']} ({lat}, {lon})")

    weather = get_weather_from_open_meteo(lat, lon)
    if not weather:
        print("Unable to fetch the weather data.")
        return

    send_to_rabbitmq("local_weather", {
        "location": location,
        "weather": weather
    })

def main():
    print("Weather service started. Will fetch weather every 10 seconds...")
    
    fetch_and_send_weather()
    schedule.every(10).seconds.do(fetch_and_send_weather)

    while True:
        schedule.run_pending()
        time.sleep(1)

if __name__ == "__main__":
    main()