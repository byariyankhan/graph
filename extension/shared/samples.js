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
    'scatter': {
        title: 'Richer and healthier', subtitle: 'Income vs life expectancy, 2020 (rounded, illustrative)', source: 'Source: World Bank (sample)',
        data: 'Country\tGDP per person (US$)\tLife expectancy\tPopulation (M)\tRegion\n' +
            'Bangladesh\t2233\t72\t167\tSouth Asia\n' +
            'India\t1916\t70\t1396\tSouth Asia\n' +
            'Pakistan\t1322\t66\t227\tSouth Asia\n' +
            'Sri Lanka\t3695\t76\t22\tSouth Asia\n' +
            'Nepal\t1155\t70\t29\tSouth Asia\n' +
            'China\t10409\t78\t1411\tEast Asia\n' +
            'Indonesia\t3870\t71\t274\tEast Asia\n' +
            'Vietnam\t3586\t75\t97\tEast Asia',
        options: { highlight: '' }, format: {}
    },
    'scatter:scatter': {
        title: 'Richer and healthier', subtitle: 'Income vs life expectancy, 2020 (rounded, illustrative)', source: 'Source: World Bank (sample)',
        data: 'Country\tGDP per person (US$)\tLife expectancy\n' +
            'Bangladesh\t2233\t72\n' +
            'India\t1916\t70\n' +
            'Pakistan\t1322\t66\n' +
            'Sri Lanka\t3695\t76\n' +
            'Nepal\t1155\t70\n' +
            'China\t10409\t78\n' +
            'Indonesia\t3870\t71\n' +
            'Vietnam\t3586\t75',
        options: { highlight: 'Bangladesh' }, format: {}
    },
    'scatter:gapminder': {
        title: 'Thirty years of progress', subtitle: 'Income vs life expectancy · bubble = population (rounded, illustrative)', source: 'Source: World Bank (sample)',
        data: 'Country\tYear\tGDP per person (US$)\tLife expectancy\tPopulation (M)\tRegion\n' +
            'Bangladesh\t1990\t306\t58\t107\tSouth Asia\n' +
            'Bangladesh\t2000\t418\t65\t129\tSouth Asia\n' +
            'Bangladesh\t2010\t781\t69\t148\tSouth Asia\n' +
            'Bangladesh\t2020\t2233\t72\t167\tSouth Asia\n' +
            'India\t1990\t368\t58\t870\tSouth Asia\n' +
            'India\t2000\t443\t62\t1060\tSouth Asia\n' +
            'India\t2010\t1351\t66\t1240\tSouth Asia\n' +
            'India\t2020\t1916\t70\t1396\tSouth Asia\n' +
            'Pakistan\t1990\t371\t60\t115\tSouth Asia\n' +
            'Pakistan\t2000\t534\t62\t154\tSouth Asia\n' +
            'Pakistan\t2010\t987\t64\t194\tSouth Asia\n' +
            'Pakistan\t2020\t1322\t66\t227\tSouth Asia\n' +
            'Sri Lanka\t1990\t463\t69\t17\tSouth Asia\n' +
            'Sri Lanka\t2000\t869\t71\t19\tSouth Asia\n' +
            'Sri Lanka\t2010\t2744\t74\t20\tSouth Asia\n' +
            'Sri Lanka\t2020\t3695\t76\t22\tSouth Asia\n' +
            'Nepal\t1990\t190\t54\t18\tSouth Asia\n' +
            'Nepal\t2000\t225\t62\t23\tSouth Asia\n' +
            'Nepal\t2010\t592\t67\t27\tSouth Asia\n' +
            'Nepal\t2020\t1155\t70\t29\tSouth Asia\n' +
            'China\t1990\t318\t69\t1135\tEast Asia\n' +
            'China\t2000\t959\t72\t1263\tEast Asia\n' +
            'China\t2010\t4550\t75\t1338\tEast Asia\n' +
            'China\t2020\t10409\t78\t1411\tEast Asia\n' +
            'Indonesia\t1990\t585\t63\t182\tEast Asia\n' +
            'Indonesia\t2000\t780\t66\t214\tEast Asia\n' +
            'Indonesia\t2010\t3122\t69\t244\tEast Asia\n' +
            'Indonesia\t2020\t3870\t71\t274\tEast Asia\n' +
            'Vietnam\t1990\t95\t70\t68\tEast Asia\n' +
            'Vietnam\t2000\t390\t73\t80\tEast Asia\n' +
            'Vietnam\t2010\t1673\t74\t88\tEast Asia\n' +
            'Vietnam\t2020\t3586\t75\t97\tEast Asia',
        options: { periodSec: 1.5 }, format: {}
    },
    'waffle': {
        title: 'Who can read?', subtitle: 'Adult literacy rate (illustrative)', source: 'Source: sample data',
        data: 'Group\tPercent\nCan read and write\t76',
        options: { restLabel: 'Cannot read' }, format: {}
    },
    'waffle:icons': {
        title: 'Where people live', subtitle: 'Out of every 100 people (illustrative)', source: 'Source: sample data',
        data: 'Area\tPeople\nCities\t40\nVillages\t60',
        options: {}, format: {}
    },
    'waffle:circles': {
        title: 'How big is Bangladesh?', subtitle: 'Land area, thousand km\u00b2 (rounded)', source: 'Source: sample data',
        data: 'Country\tArea\nIndia\t3287\nPakistan\t881\nMyanmar\t677\nNepal\t147\nBangladesh\t148\nSri Lanka\t66',
        options: { highlight: 'Bangladesh' }, format: { suffix: 'K km\u00b2' }
    },
    'compare': {
        title: 'Living longer', subtitle: 'Life expectancy at birth, years (rounded, illustrative)', source: 'Source: World Bank (sample)',
        data: 'Country\t1990\t2020\nBangladesh\t58\t72\nIndia\t58\t70\nPakistan\t60\t66\nNepal\t54\t70\nSri Lanka\t69\t76',
        options: { highlight: '' }, format: {}
    },
    'compare:dumbbell': {
        title: 'Thirty years of gains', subtitle: 'Life expectancy at birth, years (rounded, illustrative)', source: 'Source: World Bank (sample)',
        data: 'Country\t1990\t2020\nBangladesh\t58\t72\nIndia\t58\t70\nPakistan\t60\t66\nNepal\t54\t70\nSri Lanka\t69\t76',
        options: { highlight: 'Bangladesh' }, format: {}
    },
    'compare:waterfall': {
        title: 'How the population grew', subtitle: 'Million people, 2000 \u2192 2020 (illustrative)', source: 'Source: sample data',
        data: 'Step\tMillion\n2000\t129\nBirths\t60\nDeaths\t-17\nMigration\t-5',
        options: { totalLabel: '2020' }, format: { suffix: 'M' }
    },
    'compare:diverging': {
        title: 'Winners and losers', subtitle: 'Economic growth in one year, % (illustrative)', source: 'Source: sample data',
        data: 'Country\tGrowth %\nIndia\t8.2\nBangladesh\t5.8\nBhutan\t4.6\nNepal\t1.9\nPakistan\t-0.2\nSri Lanka\t-2.3',
        options: { highlight: '' }, format: { suffix: '%', decimals: 1 }
    },
    'gauge': {
        title: 'Prices are rising', subtitle: 'Inflation, % a year (illustrative)', source: 'Source: sample data',
        data: 'Measure\tValue\tMax\nInflation\t9.7\t15',
        options: {}, format: { suffix: '%', decimals: 1 }
    },
    'gauge:thermometer': {
        title: 'A warming country', subtitle: 'Hottest day of the year, \u00b0C (illustrative)', source: 'Source: sample data',
        data: 'City\tTemp\tMax\nDhaka\t40.6\t50\nRajshahi\t43.0\t50\nSylhet\t36.2\t50',
        options: {}, format: { suffix: '\u00b0', decimals: 1 }
    },
    'gauge:progress': {
        title: 'Road to the goals', subtitle: 'Progress towards 2030 targets, % (illustrative)', source: 'Source: sample data',
        data: 'Goal\tDone\tMax\tTarget\nElectricity access\t99\t100\t100\nPrimary school completion\t82\t100\t95\nSafe drinking water\t59\t100\t90\nInternet use\t39\t100\t75',
        options: {}, format: { suffix: '%' }
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
