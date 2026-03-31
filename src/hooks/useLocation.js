import { useState, useEffect, useCallback } from 'react';

/**
 * Хук для работы с геолокацией.
 * Возвращает coords (lat/lng), error, loading, и функцию refetch.
 */
export function useLocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // 'granted'|'denied'|'prompt'

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Геолокация не поддерживается вашим браузером');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setPermissionState('granted');
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setPermissionState('denied');
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Вы запретили доступ к геолокации. Разрешите доступ в настройках браузера.');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Не удалось определить местоположение. Попробуйте ещё раз.');
            break;
          case err.TIMEOUT:
            setError('Время ожидания истекло. Проверьте GPS.');
            break;
          default:
            setError('Неизвестная ошибка геолокации.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  useEffect(() => {
    // Проверяем разрешение при монтировании
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      });
    }
  }, []);

  return { coords, error, loading, permissionState, requestLocation };
}
