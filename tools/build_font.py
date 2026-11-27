#!/usr/bin/env python3
"""
Build css/music-font.css from the Leland music font (vendor/leland, a git submodule).

Keeps only the SMuFL symbols the app draws, renames the font (the SIL Open Font
License reserves the name "Leland" for the original), and embeds it as a base64
WOFF so the page works offline and when index.html is opened straight from a folder.

    pip install fonttools
    python3 tools/build_font.py            # uses vendor/leland/Leland.otf
    python3 tools/build_font.py path/to/Leland.otf
"""
import base64
import io
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAMILY = "SayItOnBeat Music"
PS_NAME = "SayItOnBeatMusic"

# Every SMuFL symbol js/notation.js uses (keep in sync with GLYPHS there).
CODEPOINTS = {
    "gClef": 0xE050, "cClef": 0xE05C, "fClef": 0xE062,
    "noteheadWhole": 0xE0A2, "noteheadHalf": 0xE0A3, "noteheadBlack": 0xE0A4,
    "augmentationDot": 0xE1E7,
    "flag8thUp": 0xE240, "flag8thDown": 0xE241, "flag16thUp": 0xE242, "flag16thDown": 0xE243,
    "accidentalFlat": 0xE260, "accidentalNatural": 0xE261, "accidentalSharp": 0xE262,
    "accidentalDoubleSharp": 0xE263, "accidentalDoubleFlat": 0xE264,
    "restWhole": 0xE4E3, "restHalf": 0xE4E4, "restQuarter": 0xE4E5, "rest8th": 0xE4E6,
    "articAccentAbove": 0xE4A0, "articStaccatoAbove": 0xE4A2, "articTenutoAbove": 0xE4A4,
    "fermataAbove": 0xE4C0,
    "segno": 0xE047, "coda": 0xE048,
    "timeSig0": 0xE080, "timeSig1": 0xE081, "timeSig2": 0xE082, "timeSig3": 0xE083, "timeSig4": 0xE084,
    "timeSig5": 0xE085, "timeSig6": 0xE086, "timeSig7": 0xE087, "timeSig8": 0xE088, "timeSig9": 0xE089,
    "noteheadXBlack": 0xE0A9,
    "articMarcatoAbove": 0xE4AC, "articStaccatissimoWedgeAbove": 0xE4A8, "articAccentStaccatoAbove": 0xE4B0,
    "articTenutoStaccatoAbove": 0xE4B2, "articTenutoAccentAbove": 0xE4B4,
    "fermataShortAbove": 0xE4C4, "fermataLongAbove": 0xE4C6, "caesura": 0xE4D1,
    "pluckedSnapPizzicatoAbove": 0xE631, "pluckedBuzzPizzicato": 0xE632, "stringsHarmonic": 0xE614,
    "tremolo3": 0xE222,
    "accidentalQuarterToneSharpStein": 0xE282, "accidentalNarrowReversedFlat": 0xE284,
    "accidentalThreeQuarterTonesSharpStein": 0xE283, "accidentalNarrowReversedFlatAndFlat": 0xE285,
    "dynamicSforzandoPiano": 0xE537,
    "tuplet3": 0xE883, "tuplet2": 0xE882, "tuplet5": 0xE885, "tuplet6": 0xE886, "tuplet7": 0xE887,
    "ornamentTrill": 0xE566, "wiggleTrill": 0xEAA4, "ornamentMordent": 0xE56D, "ornamentShortTrill": 0xE56C, "ornamentTurn": 0xE567, "ornamentTurnInverted": 0xE568, "ornamentTurnSlash": 0xE569, "ornamentTremblement": 0xE56E, "ornamentSchleifer": 0xE587, "ornamentPrecompTrillWithMordent": 0xE5BD, "repeat1Bar": 0xE500, "breathMarkComma": 0xE4CE, "fermataVeryLongAbove": 0xE4C8, "noteheadDiamondHalf": 0xE0D9,
    "graceNoteAcciaccaturaStemUp": 0xE560, "graceNoteAppoggiaturaStemUp": 0xE562,
    "timeSigCommon": 0xE08A, "timeSigCutCommon": 0xE08B,
    "dynamicPiano": 0xE520, "dynamicMezzo": 0xE521, "dynamicForte": 0xE522,
    "dynamicSforzando": 0xE524, "dynamicZ": 0xE525,
    "dynamicPP": 0xE52B, "dynamicMP": 0xE52C, "dynamicMF": 0xE52D, "dynamicFF": 0xE52F,
    "dynamicFortePiano": 0xE534, "dynamicSforzato": 0xE539,
    "dynamicPPP": 0xE52A, "dynamicFFF": 0xE530, "dynamicPPPP": 0xE529, "dynamicFFFF": 0xE531,
    "dynamicSforzando1": 0xE536, "dynamicSforzatoFF": 0xE53B, "dynamicForzando": 0xE535,
    "dynamicRinforzando1": 0xE53C, "dynamicRinforzando2": 0xE53D, "dynamicSforzatoPiano": 0xE53A,
    "dynamicNiente": 0xE526,
    "stringsDownBow": 0xE610, "stringsUpBow": 0xE612,
}


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "vendor", "leland", "Leland.otf")
    if not os.path.exists(src):
        sys.exit("Can't find %s. Run: git submodule update --init" % src)

    font = TTFont(src)
    options = subset.Options()
    options.flavor = "woff"
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    sub = subset.Subsetter(options=options)
    sub.populate(unicodes=list(CODEPOINTS.values()))
    sub.subset(font)

    # A modified OFL font must not use the reserved name.
    names = font["name"]
    for rec in list(names.names):
        if rec.nameID in (1, 16):
            names.setName(FAMILY, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (4,):
            names.setName(FAMILY, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID in (6,):
            names.setName(PS_NAME, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
        elif rec.nameID == 3:
            names.setName(PS_NAME + " (subset of Leland)", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    if "CFF " in font:
        cff = font["CFF "].cff
        cff.fontNames = [PS_NAME]
        top = cff.topDictIndex[0]
        top.FullName = FAMILY
        top.FamilyName = FAMILY

    buf = io.BytesIO()
    font.flavor = "woff"
    font.save(buf)
    data = buf.getvalue()

    version = TTFont(src)["name"].getDebugName(5) or ""
    css = (
        "/*\n"
        " * Generated by tools/build_font.py. Do not edit.\n"
        " * " + FAMILY + ": the symbols this app uses, taken from the Leland music font\n"
        " * (" + version.strip() + "), copyright MuseScore BVBA, with Reserved Font Name \"Leland\".\n"
        " * Licensed under the SIL Open Font License 1.1; see fonts/OFL.txt.\n"
        " */\n"
        "@font-face {\n"
        "  font-family: '" + FAMILY + "';\n"
        "  src: url(data:font/woff;base64," + base64.b64encode(data).decode("ascii") + ") format('woff');\n"
        "  font-display: block;\n"
        "}\n"
    )
    out = os.path.join(ROOT, "css", "music-font.css")
    with open(out, "w") as fh:
        fh.write(css)
    print("%d symbols, %d bytes of font -> %s (%d bytes)" % (len(CODEPOINTS), len(data), out, len(css)))


if __name__ == "__main__":
    main()
