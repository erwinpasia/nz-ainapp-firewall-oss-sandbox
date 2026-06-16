# Copyright 2026 Erwin R. Pasia | SU.OSM AI (erwinpasia@gmail.com)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from unidecode import unidecode

def visual_normalize(text: str) -> str:
    homoglyphs = {
        # Cyrillic
        'А': 'a', 'а': 'a',
        'В': 'b',
        'Е': 'e', 'е': 'e',
        'І': 'i', 'і': 'i',
        'О': 'o', 'о': 'o',
        'Р': 'p', 'р': 'p',
        'С': 'c', 'с': 'c',
        'Т': 't',
        'Х': 'x', 'х': 'x',
        'Ѕ': 's', 'ѕ': 's',
        'Ј': 'j',
        'К': 'k', 'к': 'k',
        'М': 'm', 'м': 'm',
        'Н': 'h', 'н': 'h',
        # Greek
        'Α': 'a', 'α': 'a',
        'Ε': 'e', 'ε': 'e',
        'Ι': 'i', 'ι': 'i',
        'Κ': 'k', 'κ': 'k',
        'Ν': 'n', 'ν': 'n',
        'Ο': 'o', 'ο': 'o',
        'Ρ': 'p', 'ρ': 'p',
        'Τ': 't', 'τ': 't',
        'Χ': 'x', 'χ': 'x',
        # Zero-width / invisible characters — collapse to space
        '\u200b': ' ', '\u200c': ' ', '\u200d': ' ', '\ufeff': ' '
    }
    return "".join(homoglyphs.get(c, c) for c in text)

def normalize_text(text: str) -> str:
    clean = visual_normalize(text)
    deunicoded = unidecode(clean)
    # Filter out all whitespace and convert to lowercase
    return "".join(c for c in deunicoded if not c.isspace()).lower()
