/*
 * Sample data for every chart type (so a new user sees a finished chart
 * immediately). Numbers are ROUNDED / ILLUSTRATIVE — always replace them
 * with sourced data before publishing.
 * Key "type" or "type:variant" (variant-specific sample wins).
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.SAMPLES = {
    'bar': {
        title: 'Most populous countries', subtitle: 'Population, millions (2024, rounded)', source: 'Source: UN World Population Prospects (sample)',
        data: 'Country\tPopulation\nIndia\t1441\nChina\t1425\nUnited States\t341\nIndonesia\t279\nPakistan\t245\nNigeria\t229\nBrazil\t217\nBangladesh\t174',
        options: { highlight: 'Bangladesh', sort: 'desc' }, format: { suffix: 'M' }
    },
    'bar:grouped': {
        title: 'Economy by sector', subtitle: 'Share of GDP, % (illustrative)', source: 'Source: sample data',
        data: 'Year\tAgriculture\tIndustry\tServices\n1990\t30\t21\t49\n2000\t24\t23\t53\n2010\t17\t26\t57\n2020\t12\t33\t55',
        options: {}, format: { suffix: '%' }
    },
    'bar:stacked': {
        title: 'Economy by sector', subtitle: 'Share of GDP, % (illustrative)', source: 'Source: sample data',
        data: 'Year\tAgriculture\tIndustry\tServices\n1990\t30\t21\t49\n2000\t24\t23\t53\n2010\t17\t26\t57\n2020\t12\t33\t55',
        options: {}, format: { suffix: '%' }
    },
    'bar:percent': {
        title: 'Where people live', subtitle: 'Urban vs rural population (illustrative)', source: 'Source: sample data',
        data: 'Year\tUrban\tRural\n1975\t10\t90\n1990\t20\t80\n2005\t27\t73\n2020\t38\t62\n2030\t45\t55',
        options: {}, format: {}
    },
    'line': {
        title: 'The South Asian race', subtitle: 'GDP per person, current US$ (rounded)', source: 'Source: World Bank (sample)',
        data: 'Year\tBangladesh\tIndia\tPakistan\n1990\t306\t368\t371\n1995\t330\t374\t462\n2000\t418\t443\t534\n2005\t482\t710\t682\n2010\t781\t1351\t987\n2015\t1248\t1590\t1356\n2020\t2233\t1916\t1322\n2023\t2551\t2481\t1365',
        options: {}, format: { prefix: '$' }
    },
    'line:stacked': {
        title: 'Energy mix over time', subtitle: 'Electricity generation by source, TWh (illustrative)', source: 'Source: sample data',
        data: 'Year\tGas\tOil\tCoal\tRenewables\n2000\t14\t1.5\t0.5\t1\n2005\t20\t2\t0.6\t1\n2010\t30\t4\t0.8\t1.2\n2015\t45\t9\t1\t1.5\n2020\t60\t10\t5\t2\n2023\t65\t12\t15\t3',
        options: {}, format: {}
    },
    'pie': {
        title: 'Where the electricity comes from', subtitle: 'Share of generation (illustrative)', source: 'Source: sample data',
        data: 'Source\tShare\nNatural gas\t51\nOil\t21\nCoal\t13\nImports\t7\nRenewables\t5\nOther\t3',
        options: {}, format: { suffix: '%' }
    },
    'pie:rings': {
        title: 'Progress on development goals', subtitle: '% achieved (illustrative)', source: 'Source: sample data',
        data: 'Goal\tPercent\nElectricity access\t99\nPrimary school enrolment\t94\nSafe drinking water\t59\nInternet use\t39',
        options: {}, format: {}
    },
    'counter': {
        title: 'A nation that doubled', subtitle: 'Population of Bangladesh', source: 'Source: sample data',
        data: 'Label\tValue\tStart\nPeople living in Bangladesh today\t173000000\t75000000',
        options: {}, format: { grouping: 'indian' }
    },
    'counter:compare': {
        title: 'Two megacities', subtitle: 'Metro population (rounded)', source: 'Source: sample data',
        data: 'City\tPopulation\nDhaka\t23900000\nKolkata\t15800000',
        options: {}, format: { compact: 'words', decimals: 1 }
    },
    'counter:cards': {
        title: 'The country in numbers', subtitle: 'Key indicators (illustrative)', source: 'Source: sample data',
        data: 'Indicator\tValue\nPopulation\t173000000\nGDP (US$)\t450000000000\nLife expectancy\t73\nLiteracy %\t76',
        options: {}, format: { compact: 'en', decimals: 0 }
    },
    'timeline': {
        title: 'Bengal: five turning points', subtitle: '', source: '',
        data: 'Year\tEvent\tNote\n1757\tBattle of Plassey\tCompany rule begins\n1905\tPartition of Bengal\tAnnulled in 1911\n1947\tPartition of India\tEast Bengal joins Pakistan\n1952\tLanguage Movement\t21 February\n1971\tIndependence\tBangladesh is born',
        options: { highlight: 'Independence' }, format: {}
    },
    'timeline:eras': {
        title: 'Who ruled Bengal?', subtitle: 'Major periods', source: '',
        data: 'Start\tEnd\tPeriod\n1352\t1576\tBengal Sultanate\n1576\t1757\tMughal Bengal\n1757\t1858\tCompany rule\n1858\t1947\tBritish Raj\n1947\t1971\tEast Pakistan\n1971\t2025\tBangladesh',
        options: {}, format: {}
    },
    'race': {
        title: 'The race to the top', subtitle: 'GDP, trillion US$ (rounded, illustrative)', source: 'Source: IMF / World Bank (sample)',
        data: 'Year\tUSA\tChina\tJapan\tGermany\tIndia\tUK\tFrance\tBrazil\tItaly\n' +
            '1980\t2.86\t0.19\t1.13\t0.95\t0.19\t0.60\t0.70\t0.24\t0.48\n' +
            '1990\t5.96\t0.36\t3.13\t1.77\t0.32\t1.09\t1.27\t0.46\t1.18\n' +
            '2000\t10.25\t1.21\t4.97\t1.95\t0.47\t1.66\t1.37\t0.66\t1.15\n' +
            '2010\t15.05\t6.09\t5.76\t3.40\t1.68\t2.49\t2.65\t2.21\t2.14\n' +
            '2020\t21.32\t14.69\t5.04\t3.89\t2.67\t2.70\t2.64\t1.48\t1.90\n' +
            '2023\t27.36\t17.79\t4.21\t4.46\t3.55\t3.34\t3.03\t2.17\t2.25',
        options: { highlight: 'India', periodSec: 1.6 }, format: { prefix: '$', suffix: 'T', decimals: 2 }
    },
    'pyramid': {
        title: 'A young nation', subtitle: 'Population by age, % of total (illustrative)', source: 'Source: sample data',
        data: 'Age\tMale\tFemale\n0-9\t9.1\t8.8\n10-19\t9.4\t9.2\n20-29\t8.6\t8.9\n30-39\t7.4\t7.6\n40-49\t5.9\t5.8\n50-59\t4.2\t4.1\n60-69\t2.6\t2.7\n70+\t1.6\t1.8',
        options: {}, format: { suffix: '%', decimals: 1 }
    }
};
DG.sample = function (type, variant) {
    return DG.SAMPLES[type + ':' + variant] || DG.SAMPLES[type];
};
