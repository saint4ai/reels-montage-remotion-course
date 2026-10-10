import React from 'react';
import {Img, staticFile} from 'remotion';

// Заглушка вместо записи спикера: студийный фон и микрофон (как в src/template/Speaker.tsx). Ролики-образцы курса
// собраны без записи автора, поэтому композиции рендерятся и без неё. Запись ученика кладётся в public/work/<slug>/,
// путь вписывается в константу REC в начале файла ролика: заглушка пропадает сама.
export const RecStub: React.FC = () => (
  <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(90% 70% at 50% 30%, #2A3036 0%, #14171A 70%)'}}>
    <Img src={staticFile('objects/mic.webp')} style={{position: 'absolute', left: '30%', top: '14%', width: '40%', height: '72%', objectFit: 'contain', maxWidth: 'none', maxHeight: 'none'}} />
  </div>
);
