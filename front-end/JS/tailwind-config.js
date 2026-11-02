// Configuração de cores e fontes do Tailwind (carregado logo depois do script do Tailwind)
tailwind.config = {
    theme: {
        extend: {
            colors: {
                paper: { light: '#f4f3ee', DEFAULT: '#f4f3ee', warm: '#e8e6df', lines: '#9cb6ad' },
                botanical: {
                    50: '#f4f3ee', 100: '#e8e6df', 200: '#9cb6ad', 300: '#9cb6ad', 400: '#4a5f5a',
                    500: '#4a5f5a', 600: '#314938', 700: '#4a5f5a', 800: '#314938', 900: '#314938'
                }
            },
            fontFamily: {
                serif: ['"Fraunces"', 'Georgia', 'serif'],
                sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
            }
        }
    }
};