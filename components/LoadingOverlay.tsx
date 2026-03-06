import React from 'react'

const LoadingOverlay = ({ message }: { message: string }) => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FFF9ED]/95 backdrop-blur-sm">
            <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-[#E9E1CC] rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#663820] rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#1C1C1C] animate-pulse">
                {message}
            </h2>
            <p className="mt-4 text-[#6B6B6B] font-medium italic">
                This might take a few moments...
            </p>
        </div>
    )
}

export default LoadingOverlay
