import RAW from '../../../../public/rm/ghtricks/words.json';
import {buildWords, makeT} from '../lensLow';

// Слова записи «Трюки со ссылками GitHub» (whisper, public/rm/ghtricks/words.json). Правки только написания: Claude, ё, числа цифрами.
export const WORDS = buildWords(RAW, {'Клод,': 'Claude,', 'еще': 'ещё', 'все': 'всё', 'DeepWIKI': 'DeepWiki', 'пять': '5', 'один': '1'});
export const {T, TE} = makeT(WORDS);
