var MS_PER_DAY = 24*60*60*1000;

$(function () {
    $.getScript('https://d3js.org/d3.v3.min.js', function () {
        var formatDate = d3.time.format("%Y-%m-%d %H:%M:%S");
        var windows = [7,14,28];
        var colors = ['#8EBACE','#AED686','#F6CF20','#FA8A8A']
        function type(d) {
            d.Date = formatDate.parse(d.Date);
            d.Weight = +d.Weight;
            return d;
        }
        d3.csv("weight.csv", type, function (error, data) {
            if (error) throw error;
            var currentWeight = parseFloat(data[0].Weight)
            var mostRecentDateWithData = removeTime(data[0].Date);
            var dateToExtrapolateTo = new Date(mostRecentDateWithData.getTime() + windows.slice(-1).pop() * MS_PER_DAY);
            
            
            var targetWeight = 180;
            var toLosePerWeek = -1.4;
            
            var fullData = data;
            // Extrapolate target weights for the next month
            var extrapolated = extrapolate( currentWeight, targetWeight, mostRecentDateWithData, dateToExtrapolateTo, toLosePerWeek );
            Array.prototype.push.apply(fullData,extrapolated)
            
            var series = getSeries( fullData.sort(function (a, b) { return b.Date.getTime() - a.Date.getTime(); } ), windows, colors );
            
            var plotlines = [];
            for( var i = 0; i < colors.length; i++) {
                plotlines.push({
                    color: colors[i],
                    width: 1,
                    value: new Date().getTime() - (((i==0)?0:windows[i-1])*MS_PER_DAY),
                    label: {
                        text: ((i==0)?'Today':(windows[i-1]).toString()+' Days ago'),
                    },
                    zIndex: 100
                });
            }
            setChart('#weight', series, plotlines, dateToExtrapolateTo);
        });
    });
});

function range(start, stop) {
    return Array.apply(null, Array(stop)).map(function (_, i) { return i; }).filter( function (n) { return n >= start; } );
}

function removeTime(dt) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function extrapolate( currentWeight, targetWeight, mostRecentDateWithData, dateToExtrapolateTo, toLosePerWeek ) {
    var series = [];
    var dt = mostRecentDateWithData;
    for(var weight = currentWeight; weight >= targetWeight && dt < dateToExtrapolateTo; weight += toLosePerWeek/7 ) {
        dt = new Date(dt.getTime() + MS_PER_DAY); 
        var d = Object()
        d.Date = dt;
        d.Weight = weight;
        series.push(d);
    }
    return series;
}

function getSeries( data, windows, colors ) {

    var avgs = windows.map(function (n) { return getRunningAverage( data, n ); });
    
    var zones =  [  {
                        value: new Date().getTime(),
                    },
                    {
                        dashStyle: 'dot'
                    }];
    
    var series = [];
    series.push( {
        type: 'line',
        name: 'Weight',
        zoneAxis: 'x',
        color: colors[0],
        data: data.reverse().map(function (d) { return [d.Date.getTime(), +d.Weight] ; } ),
        zones: zones
    });
    
    for( var i = 0; i < windows.length; i++ ) {
        var line = {
                type: 'line',
                name: windows[i].toString() + 'D Moving Average',
                color: colors[i+1],
                data: avgs[i],
                zoneAxis: 'x',
                zones: zones
                };
        series.push(line);
    }
    return series;
}

function getRunningAverage( data, window ) {
    var dateCount = Math.ceil((data[0].Date.getTime()-data[data.length-1].Date.getTime())/MS_PER_DAY);
    var arr = range(0, dateCount);
    var firstDate = removeTime(data[data.length-1].Date);
        
    var runningAvg = arr.map(function(idx) {
        
        var ithDate = firstDate.getTime() + parseInt(idx)*MS_PER_DAY;
        var weekOldDate = ithDate - window*MS_PER_DAY;
        
        var lastWeekData =   data.filter(function(d) {
            return weekOldDate <= new Date(d.Date).getTime() &&  new Date(d.Date).getTime() <= ithDate;
        }).reverse();
        
        if(lastWeekData.length <= 1) {
            // no point averaging only one or zero values
            return [data[data.length-1].Date.getTime(), data[data.length-1].Weight];
        }
        
        var sum = 0;
        var prevTime = lastWeekData[0].Date.getTime();
        var prevWeight = lastWeekData[0].Weight;
        for( var i = 0; i < lastWeekData.length; i++ ) {
            var currTime = lastWeekData[i].Date.getTime();
            var currWeight = lastWeekData[i].Weight;
            sum += ( prevWeight + currWeight ) * ( currTime  - prevTime ) / 2;
            prevTime =  currTime;
            prevWeight = currWeight;
        }
        return [ ithDate, sum / (lastWeekData[lastWeekData.length-1].Date.getTime()-lastWeekData[0].Date.getTime()) ]
    });
    return runningAvg;
}

function setChart( target, series, plotlines, dateToExtrapolateTo) {
    $(target).highcharts({
        chart: {
            zoomType: 'x'
        },
        title: {
            text: 'Weight over time'
        },
        subtitle: {
            text: ( document.ontouchstart === undefined ?
                    'Click and drag in the plot area to zoom in' : 'Pinch the chart to zoom in' ) +
                    '; dotted line is future target'
        },
        xAxis: {
            type: 'datetime',
            plotLines: plotlines,
            plotBands: [{
                from: new Date().getTime(),
                to: dateToExtrapolateTo,
                color: '#FAFAFA',
                label: { 
                    text: 'Target for next month', // Content of the label. 
                    align: 'left', // Positioning of the label.  
                    x: +50
                }
            }]
        },
        yAxis: {
            title: {
                text: 'Weight'
            }
        },
        legend: {
            enabled: true
        },
        plotOptions: {
            line: {
                marker: {
                    enabled: false
                },
                lineWidth: 3
            }
        },
        series: series
    });
}