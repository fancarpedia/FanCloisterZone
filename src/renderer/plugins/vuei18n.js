// http://docs.translatehouse.org/projects/localization-guide/en/latest/l10n/pluralforms.html
function getPluralCode(locale, n, choicesLength) {
  let plural = 0;
  let nplurals = 1;
  switch(locale) {
    case 'ca':
      nplurals=2; plural=(n != 1);
      break;
    case 'cs':
      nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;
      break;
    case 'de':
      nplurals=2; plural=(n != 1);
      break;
    case 'en':
      nplurals=2; plural=(n != 1);
      break;
    case 'es':
      nplurals=2; plural=(n != 1);
      break;
    case 'fr':
      nplurals=2; plural=(n > 1);
      break;
    case 'lt':
      nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2);
      break;
    case 'nl':
      nplurals=2; plural=(n != 1);
      break; 	
    case 'pl':
      nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);
      break;
    case 'ro':
      nplurals=3; plural=(n==1 ? 0 : (n==0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2);
      break;
    case 'ru':
      nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);
      break;
    case 'sk':
      nplurals=3; plural=(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;
      break;
    case 'sl':
      nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);
      break;
  }
  plural++;
  return (choicesLength<plural) ? choicesLength : plural;
}
function locale_ca(choice, choicesLength) {
  return getPluralCode('ca', choice, choicesLength);
}
function locale_cs(choice, choicesLength) {
  return getPluralCode('cs', choice, choicesLength);
}
function locale_de(choice, choicesLength) {
  return getPluralCode('de', choice, choicesLength);
}
function locale_en(choice, choicesLength) {
  return getPluralCode('en', choice, choicesLength);
}
function locale_es(choice, choicesLength) {
  return getPluralCode('es', choice, choicesLength);
}
function locale_fr(choice, choicesLength) {
  return getPluralCode('fr', choice, choicesLength);
}
function locale_lt(choice, choicesLength) {
  return getPluralCode('lt', choice, choicesLength);
}
function locale_nl(choice, choicesLength) {
  return getPluralCode('nl', choice, choicesLength);
}
function locale_pl(choice, choicesLength) {
  return getPluralCode('pl', choice, choicesLength);
}
function locale_ro(choice, choicesLength) {
  return getPluralCode('ro', choice, choicesLength);
}
function locale_ru(choice, choicesLength) {
  return getPluralCode('ru', choice, choicesLength);
}
function locale_sk(choice, choicesLength) {
  return getPluralCode('sk', choice, choicesLength);
}
function locale_sl(choice, choicesLength) {
  return getPluralCode('sl', choice, choicesLength);
}
      
export default (context) => {
  return {
    pluralizationRules: {
      "ca": locale_ca,
      "cs": locale_cs,
      "de": locale_de,
      "en": locale_en,
      "es": locale_es,
      "fr": locale_fr,
      "lt": locale_lt,
      "nl": locale_nl,
      "pl": locale_pl,
      "ro": locale_ro,
      "ru": locale_ru,
      "sk": locale_sk,
      "sl": locale_sl
    }
  }
}