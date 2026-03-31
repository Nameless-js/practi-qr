import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// фикс путей к иконкам
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

import React from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useState } from 'react';

const MapPicker = ({ onSelect }) => {
  const [position, setPosition] = useState([52.2752, 76.9617]); // Павлодар

  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        onSelect(lat, lng);
      }
    });
    return null;
  };

  return (
    <MapContainer center={position} zoom={13} style={{ height: '300px', borderRadius: '12px' }}>
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={position} />
      <MapClickHandler />
    </MapContainer>
  );
};

export default MapPicker;