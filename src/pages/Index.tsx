
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-slate-100 p-4">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-4xl font-bold text-blue-900 mb-6">Deric MT5 Trade Trigger Extension</h1>
        <p className="text-xl text-slate-700 mb-8">
          A Chrome extension that automatically triggers trades in MetaTrader 5 based on a sophisticated crossover strategy with multiple filters.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card>
            <CardHeader>
              <CardTitle>Trading Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Implements a SMA crossover strategy (15 and 100 period) with a 200 EMA filter, volume conditions, and risk management features.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>MT5 Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Automatically detects MT5 web terminals and places trades based on your strategy parameters and filters.</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Risk Management</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Includes ATR-based stop losses, customizable lot sizes, and favorable risk-reward ratio filters for safer trading.</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-blue-800 mb-4">Installation Instructions</h2>
          <Card>
            <CardContent className="pt-6">
              <ol className="text-left space-y-4">
                <li>
                  <span className="font-medium">Step 1:</span> Download the extension files by clicking the button below.
                </li>
                <li>
                  <span className="font-medium">Step 2:</span> Open Chrome and navigate to <code className="bg-slate-100 px-2 py-1 rounded text-blue-700">chrome://extensions</code>
                </li>
                <li>
                  <span className="font-medium">Step 3:</span> Enable "Developer mode" in the top-right corner.
                </li>
                <li>
                  <span className="font-medium">Step 4:</span> Click "Load unpacked" and select the folder containing the extension files.
                </li>
                <li>
                  <span className="font-medium">Step 5:</span> Pin the extension to your toolbar for easy access.
                </li>
              </ol>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button className="bg-blue-600 hover:bg-blue-700">Download Extension Files</Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-blue-800 mb-4">How It Works</h2>
          <div className="flex flex-col space-y-4">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg text-blue-700 mb-2">Signal Generation</h3>
              <p className="text-slate-700">
                The extension monitors price data from MT5 charts and calculates moving averages and other indicators in real-time.
                When all conditions align (crossover, 200 EMA filter, volume conditions, etc.), it generates a trading signal.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg text-blue-700 mb-2">Trade Execution</h3>
              <p className="text-slate-700">
                When a valid signal is detected, the extension interacts with the MT5 web interface to place a trade with the appropriate
                stop loss and take profit levels based on ATR calculations.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg text-blue-700 mb-2">Customization</h3>
              <p className="text-slate-700">
                All strategy parameters are customizable through the extension popup, including moving average periods, 
                lot sizes, ATR length, and cooldown periods between trades.
              </p>
            </div>
          </div>
        </div>
        
        <div>
          <p className="text-slate-600 text-sm">
            Disclaimer: Trading involves risk. This extension is provided as-is with no guarantees. 
            Always monitor automated trading activities and use at your own risk.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
